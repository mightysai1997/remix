import fs from "fs-extra";
import path from "node:path";
import prettyMs from "pretty-ms";
import execa from "execa";
import express from "express";

import * as Channel from "../channel";
import { type Manifest } from "../manifest";
import * as Compiler from "../compiler";
import { type RemixConfig } from "../config";
import { loadEnv } from "./env";
import * as Socket from "./socket";
import * as HMR from "./hmr";
import { warnOnce } from "../warnOnce";

export let serve = async (
  config: RemixConfig,
  options: {
    command?: string;
    httpPort: number;
    websocketPort: number;
    restart: boolean;
  }
) => {
  await loadEnv(config.rootDirectory);
  let websocket = Socket.serve({ port: options.websocketPort });

  let state: {
    latestBuildHash?: string;
    buildHashChannel?: Channel.Type<void>;
    appServer?: execa.ExecaChildProcess;
    prevManifest?: Manifest;
  } = {};

  let startAppServer = (command: string) => {
    return execa.command(command, {
      stdio: "inherit",
      env: {
        NODE_ENV: "development",
        PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH}`,
        REMIX_DEV_HTTP_PORT: String(options.httpPort),
      },
    });
  };

  let dispose = await Compiler.watch(
    {
      config,
      options: {
        mode: "development",
        liveReloadPort: options.websocketPort, // TODO: rename liveReloadPort
        sourcemap: true,
        onWarning: warnOnce,
      },
    },
    {
      onInitialBuild: (durationMs, manifest) => {
        console.info(`💿 Built in ${prettyMs(durationMs)}`);
        state.prevManifest = manifest;
        if (options.command && manifest) {
          console.log(`starting: ${options.command}`);
          state.appServer = startAppServer(options.command);
        }
      },
      onRebuildStart: () => {
        clean(config);
        websocket.log("Rebuilding...");
      },
      onRebuildFinish: async (durationMs, manifest) => {
        if (!manifest) return;
        websocket.log(`Rebuilt in ${prettyMs(durationMs)}`);

        // TODO: should we restart the app server when build failed?
        state.latestBuildHash = manifest.version;
        state.buildHashChannel = Channel.create();
        console.log(`Waiting (${state.latestBuildHash})`);
        if (state.appServer === undefined || options.restart) {
          console.log(`restarting: ${options.command}`);
          state.appServer?.kill();
          if (options.command) {
            state.appServer = startAppServer(options.command);
          }
        }
        await state.buildHashChannel.result;

        if (manifest.hmr && state.prevManifest) {
          let updates = HMR.updates(config, manifest, state.prevManifest);
          websocket.hmr(manifest, updates);
          console.log("> HMR");
        } else {
          websocket.reload();
          console.log("> Reload");
        }
        state.prevManifest = manifest;
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
    .listen(options.httpPort, () => {
      console.log(`dev server listening on port ${options.httpPort}`);
    });

  return new Promise(() => {}).finally(async () => {
    state.appServer?.kill();
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
