import { createRequestHandler as createRemixRequestHandler } from "@remix-run/deno";
import type { ServerBuild } from "@remix-run/deno";
import type { Context } from "@netlify/edge-functions";

// Deno will exist in Deno land and we only need the minimal types for ProcessEnv
// The types for this for Deno are defined in globals.d.ts in the Netlify template
// @ts-ignore
globalThis.process ||= { env: Deno.env.toObject() };

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (
  request: Request,
  context: Context
) => Promise<Context> | Context;

export type RequestHandler = (
  request: Request,
  context: Context
) => Promise<Response | void>;

export function createRequestHandler({
  build,
  mode,
  getLoadContext,
}: {
  build: ServerBuild;
  mode?: string;
  getLoadContext?: GetLoadContextFunction;
}): RequestHandler {
  let remixHandler = createRemixRequestHandler({ build, mode });

  let assetPath = build.assets.url.split("/").slice(0, -1).join("/");

  return async (
    request: Request,
    context: Context
  ): Promise<Response | void> => {
    let { pathname } = new URL(request.url);
    // Skip the handler for static files
    if (pathname.startsWith(`${assetPath}/`)) {
      return;
    }
    try {
      let loadContext = (await getLoadContext?.(request, context)) || context;

      let response = await remixHandler(request, loadContext);
      if (response.status === 404) {
        // Check if there is a matching static file
        let originResponse = await context.next({
          sendConditionalRequest: true,
        });
        if (originResponse.status !== 404) {
          return originResponse;
        }
      }
      return response;
    } catch (e) {
      console.error(e);

      return new Response("Internal Error", { status: 500 });
    }
  };
}
