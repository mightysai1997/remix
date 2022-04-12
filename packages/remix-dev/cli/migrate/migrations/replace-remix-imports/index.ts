import { readFile } from "fs/promises";
import glob from "fast-glob";
import { join } from "path";
import type { PackageJson } from "type-fest";

import * as jscodeshift from "../../jscodeshift";
import {
  findRemixDependencies,
  getTransformOptions,
} from "./getTransformOptions";
import type { Options } from "./transform";
import { isAdapter, isRuntime } from "./transform";
import type { MigrationFunction } from "../../types";
import { readConfig } from "../../../../config";
import { hint } from "../../../../logging";
import * as colors from "../../../../colors";

const transformPath = join(__dirname, "transform");

function* getTasks({
  packageJson,
  runtime,
  adapter,
}: {
  packageJson: PackageJson;
  runtime: string;
  adapter?: string;
}): Generator<string> {
  let commandTask = (message: string, command: string) =>
    `${message}:\n\t${colors.hint(command)}`;
  let remixRunPrefix = (dep: string) => "@remix-run/" + dep;
  let remixDeps = findRemixDependencies(packageJson.dependencies);

  // runtime not in deps
  if (!remixDeps.includes(runtime)) {
    yield commandTask(
      `Install \`@remix-run/${runtime}\` as a dependency`,
      `npm install @remix-run/${runtime}`
    );
  }

  // other runtimes in deps
  let otherRuntimes = remixDeps
    .filter(isRuntime)
    .filter((dep) => dep !== runtime);
  if (otherRuntimes.length > 0) {
    yield commandTask(
      "Uninstall all unused runtimes",
      `npm uninstall ${otherRuntimes.map(remixRunPrefix).join(" ")}`
    );
  }

  // adapter not in deps
  if (adapter && !remixDeps.includes(adapter)) {
    yield commandTask(
      `Install \`@remix-run/${adapter}\` as a dependency`,
      `npm install @remix-run/${adapter}`
    );
  }

  // other adapters in deps
  let otherAdapters = remixDeps
    .filter(isAdapter)
    .filter((dep) => dep !== adapter);
  if (otherAdapters.length > 0) {
    yield commandTask(
      "Uninstall all unused adapters",
      `npm uninstall ${otherAdapters.map(remixRunPrefix).join(" ")}`
    );
  }

  // remix in deps
  if (Object.keys(packageJson.dependencies || {}).includes("remix")) {
    yield commandTask(
      "Uninstall `remix` as a dependency",
      "npm uninstall remix"
    );
  }

  // `remix setup` in `postinstall`
  let remixSetup =
    packageJson.scripts?.postinstall?.match(/remix setup(\s+\w+)?/);
  if (remixSetup) {
    yield `Remove \`${remixSetup[0]}\` from your \`postinstall\` script`;
  }
}

export const replaceRemixImports: MigrationFunction = async ({
  projectDir,
  flags,
}) => {
  // find all Javascript and Typescript files within Remix app directory
  let config = await readConfig(projectDir);
  let files = glob.sync("**/*.+(js|jsx|ts|tsx)", {
    cwd: config.appDirectory,
    absolute: true,
  });

  // run the codemod
  let pkgJsonPath = join(projectDir, "package.json");
  let packageJson: PackageJson = JSON.parse(
    await readFile(pkgJsonPath, "utf-8")
  );
  let { runtime, adapter } = await getTransformOptions(packageJson);

  console.log("💿 Running codemod...");
  let codemodOk = jscodeshift.run<Options>({
    transformPath,
    files,
    flags,
    transformOptions: { runtime, adapter },
  });
  if (codemodOk) {
    console.log("✅ Codemod ran successfully!");
  } else {
    console.error("❌ Codemod encountered errors");
    if (!flags.debug) {
      console.log(
        hint("Try again with the `--debug` flag to see what failed.")
      );
    }
    process.exit(1);
  }

  console.log("\n💿 Checking if manual migration steps are necessary...");
  // ask the user to do some post-migration tasks
  let tasks = [...getTasks({ packageJson, runtime, adapter })];
  if (tasks.length > 0) {
    console.warn("⚠️  Manual migration steps are necessary");
    console.log(
      "\nYou're almost there! To finish the migration, please perform the following steps:"
    );
    tasks.forEach((task) => console.log("👉 " + task));
    process.exit(1);
  }
  console.log("✅ No manual migration steps are necessary!");
  console.log("✅ Migration complete!");
};
