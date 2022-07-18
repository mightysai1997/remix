import * as path from "path";
import type * as esbuild from "esbuild";
import { memoize } from "lodash";

import type { RemixConfig } from "../config";
import invariant from "../invariant";
import { getRouteModuleExportsCached } from "./routes";
import { getHash } from "./utils/crypto";
import { createUrl } from "./utils/url";

type Route = RemixConfig["routes"][string];

export interface AssetsManifest {
  version: string;
  url?: string;
  entry: {
    module: string;
    imports: string[];
  };
  routes: {
    [routeId: string]: {
      id: string;
      parentId?: string;
      path?: string;
      index?: boolean;
      caseSensitive?: boolean;
      module: string;
      imports?: string[];
      hasAction: boolean;
      hasLoader: boolean;
      hasCatchBoundary: boolean;
      hasErrorBoundary: boolean;
    };
  };
}

export async function createAssetsManifest(
  config: RemixConfig,
  metafile: esbuild.Metafile
): Promise<AssetsManifest> {
  function resolveUrl(outputPath: string): string {
    return createUrl(
      config.publicPath,
      path.relative(config.assetsBuildDirectory, path.resolve(outputPath))
    );
  }

  function resolveImports(
    imports: esbuild.Metafile["outputs"][string]["imports"]
  ): string[] {
    return imports
      .filter((im) => im.kind === "import-statement")
      .map((im) => resolveUrl(im.path));
  }

  let entryClientFile = path.resolve(
    config.appDirectory,
    config.entryClientFile
  );
  let routesByFile: Map<string, Route> = Object.keys(config.routes).reduce(
    (map, key) => {
      let route = config.routes[key];
      map.set(route.file, route);
      return map;
    },
    new Map()
  );

  let entry: AssetsManifest["entry"] | undefined;
  let routes: AssetsManifest["routes"] = {};

  for (let key of Object.keys(metafile.outputs).sort()) {
    let output = metafile.outputs[key];
    if (!output.entryPoint) continue;

    // When using yarn-pnp, esbuild-plugin-pnp resolves files under the pnp namespace, even entry.client.tsx
    let entryPointFile = output.entryPoint.replace(/^pnp:/, "");
    if (path.resolve(entryPointFile) === entryClientFile) {
      entry = {
        module: resolveUrl(key),
        imports: resolveImports(output.imports),
      };
      // Only parse routes otherwise dynamic imports can fall into here and fail the build
    } else if (entryPointFile.startsWith("browser-route-module:")) {
      entryPointFile = entryPointFile.replace(
        /(^browser-route-module:|\?browser$)/g,
        ""
      );
      let route = routesByFile.get(entryPointFile);
      invariant(route, `Cannot get route for entry point ${output.entryPoint}`);
      let sourceExports = await getRouteModuleExportsCached(config, route.id);
      routes[route.id] = {
        id: route.id,
        parentId: route.parentId,
        path: route.path,
        index: route.index,
        caseSensitive: route.caseSensitive,
        module: resolveUrl(key),
        imports: resolveImports(output.imports),
        hasAction: sourceExports.includes("action"),
        hasLoader: sourceExports.includes("loader"),
        hasCatchBoundary: sourceExports.includes("CatchBoundary"),
        hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
      };
    }
  }

  invariant(entry, `Missing output for entry point`);

  optimizeRoutes(routes, entry.imports);
  let version = getHash(JSON.stringify({ entry, routes })).slice(0, 8);

  return { version, entry, routes };
}

function optimizeRoutes(
  routes: AssetsManifest["routes"],
  entryImports: string[]
): void {
  Object.keys(routes).forEach((key) => {
    memoizedOptimizeRouteImports(key, routes, entryImports);
  });
}

// Memoize is an optimization that allows us to avoid pruning the same
// route's imports more than once, with the first argument as cache key.
let memoizedOptimizeRouteImports = memoize(optimizeRouteImports);

function optimizeRouteImports(
  routeId: string,
  routes: AssetsManifest["routes"],
  parentImports: string[]
): string[] {
  let route = routes[routeId];

  if (route.parentId) {
    parentImports = parentImports.concat(
      memoizedOptimizeRouteImports(route.parentId, routes, parentImports)
    );
  }

  let routeImports = (route.imports || []).filter(
    (url) => !parentImports.includes(url)
  );

  // Setting `route.imports = undefined` prevents `imports: []` from showing up
  // in the manifest JSON when there are no imports.
  route.imports = routeImports.length > 0 ? routeImports : undefined;

  return routeImports;
}
