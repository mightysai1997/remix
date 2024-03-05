import path from "node:path";
import fse from "fs-extra";
import { spawn } from "cross-spawn";

const args = process.argv.slice(2);
const publish = process.env.CI || args.includes("--publish");
const tsc = process.env.CI || args.includes("--tsc") || publish;

exec("yarn", ["rollup", "-c"])
  .then(() => tsc && exec("yarn", ["tsc", "-b"]))
  .then(() => {
    let { LOCAL_BUILD_DIRECTORY } = process.env;
    if (LOCAL_BUILD_DIRECTORY) {
      let appDir = path.resolve(LOCAL_BUILD_DIRECTORY);
      try {
        fse.readdirSync(path.join(appDir, "node_modules"));
      } catch {
        console.error(
          "Oops! You pointed LOCAL_BUILD_DIRECTORY to a directory that " +
            "does not have a node_modules/ folder. Please `npm install` in that " +
            "directory and try again."
        );
        process.exit(1);
      }
      fse.copySync("build", appDir, { overwrite: true });
      fse.chmodSync(path.join(appDir, "node_modules/.bin/remix"), 0o755);
    }
  })
  .then(() => publish && exec("node", ["scripts/copy-build-to-dist.mjs"]))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/**
 * @param {string} command
 * @param {string[]} [args]
 */
function exec(command, args) {
  /** @type {(data: any) => any} */
  let handleData = (data) => console.log(data.toString().trim());

  /** @type {(data: Error) => any} */
  let handleError = (data) => console.error(data.toString().trim());

  return new Promise((resolve, reject) => {
    let ls = spawn(command, args, { cwd: process.cwd() });
    ls.stdout.on("data", handleData);
    ls.stderr.on("data", handleData);
    ls.on("error", handleError);
    ls.on("close", (code) => {
      if (code === 0) {
        resolve(void 0);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}
