import type * as express from "express";
import type { AppLoadContext, ServerBuild } from "@remix-run/node";
import {
  createRequestHandler as createRemixRequestHandler,
  createReadableStreamFromReadable,
  writeReadableStreamToWritable,
} from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action, such as
 * values that are generated by Express middleware like `req.session`.
 */
export type GetLoadContextFunction = (
  req: express.Request,
  res: express.Response
) => Promise<AppLoadContext> | AppLoadContext;

export type RequestHandler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<void>;

/**
 * Returns a request handler for Express that serves the response using Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}): RequestHandler {
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      let request = createRemixRequest(req, res);
      let loadContext = await getLoadContext?.(req, res);

      let response = await handleRequest(request, loadContext);

      await sendRemixResponse(res, response);
    } catch (error: unknown) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      next(error);
    }
  };
}

export function createRemixHeaders(
  requestHeaders: express.Request["headers"]
): Headers {
  let headers = new Headers();

  for (let [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      if (Array.isArray(values)) {
        for (let value of values) {
          headers.append(key, value);
        }
      } else {
        headers.set(key, values);
      }
    }
  }

  return headers;
}

export function createRemixRequest(
  req: express.Request,
  res: express.Response
): Request {
  let url = new URL(`${req.protocol}://${req.get("host")}${req.url}`);

  // Abort action/loaders once we can no longer write a response
  let controller = new AbortController();
  res.on("close", () => controller.abort());

  let init: RequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    signal: controller.signal,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = createReadableStreamFromReadable(req);
    (init as { duplex: "half" }).duplex = "half";
  }

  return new Request(url.href, init);
}

export async function sendRemixResponse(
  res: express.Response,
  nodeResponse: Response
): Promise<void> {
  res.statusMessage = nodeResponse.statusText;
  res.status(nodeResponse.status);

  for (let [key, value] of nodeResponse.headers.entries()) {
    res.append(key, value);
  }

  if (nodeResponse.body) {
    await writeReadableStreamToWritable(nodeResponse.body, res);
  } else {
    res.end();
  }
}
