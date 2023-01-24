import type { IncomingMessage, ServerResponse } from "http";
import type {
  AppLoadContext,
  ServerBuild,
  RequestInit as NodeRequestInit,
  Response as NodeResponse,
} from "@remix-run/node";
import {
  AbortController as NodeAbortController,
  createRequestHandler as createRemixRequestHandler,
  Headers as NodeHeaders,
  Request as NodeRequest,
  writeReadableStreamToWritable,
} from "@remix-run/node";
export type NextHandler = (err?: unknown) => void | Promise<void>;

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action, such as
 * values that are generated by Express middleware like `req.session`.
 */
export type GetLoadContextFunction = (
  req: IncomingMessage,
  res: ServerResponse
) => AppLoadContext;

export type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextHandler
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
    req: IncomingMessage,
    res: ServerResponse,
    next: NextHandler
  ) => {
    try {
      let request = createRemixRequest(req, res);
      let loadContext = getLoadContext?.(req, res);

      let response = (await handleRequest(
        request,
        loadContext
      )) as NodeResponse;

      await sendRemixResponse(res, response);
    } catch (error: unknown) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      next(error);
    }
  };
}

export function createRemixHeaders(
  requestHeaders: IncomingMessage["headers"]
): NodeHeaders {
  let headers = new NodeHeaders();

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
  req: IncomingMessage,
  res: ServerResponse
): NodeRequest {
  // GET PROTOCOL
  let proto = (req.socket as unknown as { encrypted: boolean }).encrypted
    ? "https"
    : "http";
  let protoHeaderValue = req.headers["x-forwarded-proto"] || proto;
  let protoHeader: string = Array.isArray(protoHeaderValue)
    ? protoHeaderValue[0]
    : protoHeaderValue;
  let index = protoHeader.indexOf(",");
  let protocol =
    index !== -1 ? protoHeader.substring(0, index).trim() : protoHeader.trim();

  let origin = `${protocol}://${req.headers.host}`;
  let url = new URL(req.url as string, origin);

  // Abort action/loaders once we can no longer write a response
  let controller = new NodeAbortController();
  res.on("close", () => controller.abort());

  let init: NodeRequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    // Cast until reason/throwIfAborted added
    // https://github.com/mysticatea/abort-controller/issues/36
    signal: controller.signal as NodeRequestInit["signal"],
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
  }

  return new NodeRequest(url.href, init);
}

function appendHeader(
  res: ServerResponse,
  key: string,
  value: string | string[]
) {
  let prev = res.getHeader(key) as string | string[] | undefined
  if (prev) {
    value = Array.isArray(prev)
      ? prev.concat(value)
      : Array.isArray(value)
      ? [prev].concat(value)
      : [prev, value];
  }
  res.setHeader(key, value);
}

export async function sendRemixResponse(
  res: ServerResponse,
  nodeResponse: NodeResponse
): Promise<void> {
  res.statusMessage = nodeResponse.statusText;
  res.statusCode = nodeResponse.status;

  for (let [key, values] of Object.entries(nodeResponse.headers.raw())) {
    for (let value of values) {
      appendHeader(res, key, value);
    }
  }

  if (nodeResponse.body) {
    await writeReadableStreamToWritable(nodeResponse.body, res);
  } else {
    res.end();
  }
}
