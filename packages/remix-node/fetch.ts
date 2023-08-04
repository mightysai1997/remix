import type { Readable } from "stream";
import {
  fetch as webFetch,
  Headers as WebHeaders,
  Request as WebRequest,
  Response as WebResponse,
} from "@remix-run/web-fetch";
export { FormData } from "@remix-run/web-fetch";
export { File, Blob } from "@remix-run/web-file";

type NodeHeadersInit = ConstructorParameters<typeof WebHeaders>[0];
type NodeResponseInit = NonNullable<
  ConstructorParameters<typeof WebResponse>[1]
>;
type NodeRequestInfo =
  | ConstructorParameters<typeof WebRequest>[0]
  | WebRequest;
type NodeRequestInit = Omit<
  NonNullable<ConstructorParameters<typeof WebRequest>[1]>,
  "body"
> & {
  body?:
    | NonNullable<ConstructorParameters<typeof WebRequest>[1]>["body"]
    | Readable;
};

export type {
  NodeHeadersInit as HeadersInit,
  NodeRequestInfo as RequestInfo,
  NodeRequestInit as RequestInit,
  NodeResponseInit as ResponseInit,
};

export {
  WebHeaders as Headers,
  WebRequest as Request,
  WebResponse as Response,
};

export const fetch: typeof webFetch = (
  info: NodeRequestInfo,
  init?: NodeRequestInit
) => {
  init = {
    // Disable compression handling so people can return the result of a fetch
    // directly in the loader without messing with the Content-Encoding header.
    compress: false,
    ...init,
  };

  return webFetch(info, init as RequestInit);
};
