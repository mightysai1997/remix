import inquirer from "inquirer";
import type { PackageJson } from "type-fest";

import { error, hint } from "../../../../logging";
import type { Options } from "./transform";
import { runtimes, isRuntime, isAdapter } from "./transform";
import type {
  Adapter,
  Runtime,
} from "./transform/mapNormalizedImports/packageExports";

const getRuntime = async ({ scripts }: PackageJson): Promise<Runtime> => {
  // match `remix setup <runtime>` in `postinstall` script
  let remixSetupMatch = scripts?.postinstall?.match(/remix setup (\w+)/);
  if (remixSetupMatch && remixSetupMatch.length >= 2) {
    let postinstallRuntime = remixSetupMatch[1];
    if (isRuntime(postinstallRuntime)) {
      return postinstallRuntime;
    }
  }

  // otherwise, ask user for runtime
  let { runtime } = await inquirer.prompt<{ runtime?: Runtime }>([
    {
      name: "runtime",
      message: "Which server runtime is this project using?",
      type: "list",
      pageSize: runtimes.length + 1,
      choices: [...runtimes, { name: "Nevermind...", value: undefined }],
    },
  ]);
  if (runtime === undefined) process.exit(0);
  return runtime;
};

const getAdapter = ({ dependencies }: PackageJson): Adapter | undefined => {
  // find adapter in package.json dependencies
  let matched = Object.keys(dependencies || {})
    .filter((dep) => dep.startsWith("@remix-run/"))
    .map((dep) => dep.replace("@remix-run/", ""))
    .filter(isAdapter);

  if (matched.length > 1) {
    console.error(
      error(
        `Found multiple Remix server adapters in dependencies: ${matched.join(
          ","
        )}`
      )
    );
    console.log(
      hint(
        "You should only need one Remix server adapter. Uninstall unused server adapter packages and try again."
      )
    );
    process.exit(1);
  }

  if (matched.length === 1) return matched[0];

  return undefined;
};

export const getTransformOptions = async (
  packageJson: PackageJson
): Promise<Options> => ({
  adapter: getAdapter(packageJson),
  runtime: await getRuntime(packageJson),
});
