import * as path from "node:path";
import * as stream from "node:stream";
import fs from "fs-extra";
import prettyMs from "pretty-ms";
import execa from "execa";
import express from "express";

import * as Channel from "../channel";
import { type Manifest } from "../manifest";
import * as Compiler from "../compiler";
import { readConfig, type RemixConfig } from "../config";
import { loadEnv } from "./env";
import * as Socket from "./socket";
import * as HMR from "./hmr";
import { warnOnce } from "../warnOnce";
import { detectPackageManager } from "../cli/detectPackageManager";

type Origin = {
  scheme: string;
  host: string;
  port: number;
};

let stringifyOrigin = (o: Origin) => `${o.scheme}://${o.host}:${o.port}`;

let patchPublicPath = (
  config: RemixConfig,
  devHttpOrigin: Origin
): RemixConfig => {
  // set public path to point to dev server
  // so that browser asks the dev server for assets
  return {
    ...config,
    // dev server has its own origin, to `/build/` path will not cause conflicts with app server routes
    publicPath: stringifyOrigin(devHttpOrigin) + "/build/",
  };
};

let detectBin = async (): Promise<string> => {
  let pkgManager = detectPackageManager() ?? "npm";
  if (pkgManager === "npm") {
    // npm v9 removed the `bin` command, so have to use `prefix`
    let { stdout } = await execa(pkgManager, ["prefix"]);
    return stdout.trim() + "/node_modules/.bin";
  }
  let { stdout } = await execa(pkgManager, ["bin"]);
  return stdout.trim();
};

export let serve = async (
  initialConfig: RemixConfig,
  options: {
    command: string;
    httpScheme: string;
    httpHost: string;
    httpPort: number;
    websocketPort: number;
    restart: boolean;
  }
) => {
  await loadEnv(initialConfig.rootDirectory);
  let websocket = Socket.serve({ port: options.websocketPort });
  let httpOrigin: Origin = {
    scheme: options.httpScheme,
    host: options.httpHost,
    port: options.httpPort,
  };

  let state: {
    latestBuildHash?: string;
    buildHashChannel?: Channel.Type<void>;
    appServer?: execa.ExecaChildProcess;
    prevManifest?: Manifest;
  } = {};

  let bin = await detectBin();
  let startAppServer = (command: string) => {
    console.log(`> ${command}`);
    let newAppServer = execa.command(command, {
      stdio: "pipe",
      env: {
        NODE_ENV: "development",
        PATH: `${bin}:${process.env.PATH}`,
        REMIX_DEV_HTTP_ORIGIN: stringifyOrigin(httpOrigin),
      },
    });

    if (newAppServer.stdin)
      process.stdin.pipe(newAppServer.stdin, { end: true });
    if (newAppServer.stderr)
      newAppServer.stderr.pipe(process.stderr, { end: false });
    if (newAppServer.stdout) {
      newAppServer.stdout
        .pipe(
          new stream.PassThrough({
            transform(chunk, _, callback) {
              let str: string = chunk.toString();
              let matches =
                str && str.matchAll(/\[REMIX DEV\] ([A-f0-9]+) ready/g);
              if (matches) {
                for (let match of matches) {
                  let buildHash = match[1];
                  if (buildHash === state.latestBuildHash) {
                    state.buildHashChannel?.ok();
                  }
                }
              }

              callback(null, chunk);
            },
          })
        )
        .pipe(process.stdout, { end: false });
    }

    return newAppServer;
  };

  let dispose = await Compiler.watch(
    {
      config: patchPublicPath(initialConfig, httpOrigin),
      options: {
        mode: "development",
        sourcemap: true,
        onWarning: warnOnce,
        devHttpOrigin: httpOrigin,
        devWebsocketPort: options.websocketPort,
      },
    },
    {
      reloadConfig: async (root) => {
        let config = await readConfig(root);
        return patchPublicPath(config, httpOrigin);
      },
      onBuildStart: (ctx) => {
        state.buildHashChannel?.err();
        clean(ctx.config);
        websocket.log(state.prevManifest ? "Rebuilding..." : "Building...");
      },
      onBuildFinish: async (ctx, durationMs, manifest) => {
        if (!manifest) return;

        websocket.log(
          (state.prevManifest ? "Rebuilt" : "Built") +
            ` in ${prettyMs(durationMs)}`
        );
        let prevManifest = state.prevManifest;
        state.prevManifest = manifest;
        state.latestBuildHash = manifest.version;
        state.buildHashChannel = Channel.create();

        let start = Date.now();
        console.log(`Waiting for app server (${state.latestBuildHash})`);
        if (
          options.command &&
          (state.appServer === undefined || options.restart)
        ) {
          await kill(state.appServer);
          state.appServer = startAppServer(options.command);
        }
        let { ok } = await state.buildHashChannel.result;
        // result not ok -> new build started before this one finished. do not process outdated manifest
        if (!ok) return;
        console.log(`App server took ${prettyMs(Date.now() - start)}`);

        if (manifest.hmr && prevManifest) {
          let updates = HMR.updates(ctx.config, manifest, prevManifest);
          websocket.hmr(manifest, updates);

          let hdr = updates.some((u) => u.revalidate);
          console.log("> HMR" + (hdr ? " + HDR" : ""));
        } else if (prevManifest !== undefined) {
          websocket.reload();
          console.log("> Live reload");
        }
      },
      onFileCreated: (file) =>
        websocket.log(`File created: ${relativePath(file)}`),
      onFileChanged: (file) =>
        websocket.log(`File changed: ${relativePath(file)}`),
      onFileDeleted: (file) =>
        websocket.log(`File deleted: ${relativePath(file)}`),
    }
  );

  let httpServer = express()
    // statically serve built assets
    .use((_, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      next();
    })
    .use(
      "/build",
      express.static(initialConfig.assetsBuildDirectory, {
        immutable: true,
        maxAge: "1y",
      })
    )

    // handle `broadcastDevReady` messages
    .use(express.json())
    .post("/ping", (req, res) => {
      let { buildHash } = req.body;
      if (typeof buildHash !== "string") {
        console.warn(`Unrecognized payload: ${req.body}`);
        res.sendStatus(400);
      }
      if (buildHash === state.latestBuildHash) {
        state.buildHashChannel?.ok();
      }
      res.sendStatus(200);
    })
    .listen(httpOrigin.port, () => {
      console.log("Remix dev server ready");
    });

  return new Promise(() => {}).finally(async () => {
    await kill(state.appServer);
    websocket.close();
    httpServer.close();
    await dispose();
  });
};

let clean = (config: RemixConfig) => {
  try {
    fs.emptyDirSync(config.relativeAssetsBuildDirectory);
  } catch {}
};

let relativePath = (file: string) => path.relative(process.cwd(), file);

let kill = async (p?: execa.ExecaChildProcess) => {
  if (p === undefined) return;
  // `execa`'s `kill` is not reliable on windows
  if (process.platform === "win32") {
    await execa("taskkill", ["/pid", String(p.pid), "/f", "/t"]);
    return;
  }

  // wait one tick of the event loop so that we guarantee app server gets killed before proceeding
  p.kill("SIGTERM", { forceKillAfterTimeout: 0 });
  await new Promise((resolve) => setTimeout(resolve, 0));
};
