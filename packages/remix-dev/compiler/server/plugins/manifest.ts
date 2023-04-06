import type { Plugin } from "esbuild";
import jsesc from "jsesc";

import type { ReadChannel } from "../../../channel";
import { type Manifest } from "../../../manifest";
import { CancelError } from "../../error";
import { assetsManifestVirtualModule } from "../virtualModules";

/**
 * Creates a virtual module called `@remix-run/dev/assets-manifest` that exports
 * the assets manifest. This is used in the server entry module to access the
 * assets manifest in the server build.
 */
export function serverAssetsManifestPlugin(channels: {
  manifest: ReadChannel<Manifest>;
}): Plugin {
  let filter = assetsManifestVirtualModule.filter;

  return {
    name: "server-assets-manifest",
    setup(build) {
      build.onResolve({ filter }, ({ path }) => {
        return {
          path,
          namespace: "server-assets-manifest",
        };
      });

      build.onLoad({ filter }, async () => {
        let manifest = await channels.manifest.read().catch(() => {
          throw CancelError({
            fasdf,
          });
          throw Error("Canceled by manifest channel");
        });
        return {
          contents: `export default ${jsesc(manifest, { es6: true })};`,
          loader: "js",
        };
      });
    },
  };
}
