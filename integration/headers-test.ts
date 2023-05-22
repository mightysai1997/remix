import { test, expect } from "@playwright/test";

import { createFixture, js } from "./helpers/create-fixture";
import type { Fixture } from "./helpers/create-fixture";

test.describe("headers export", () => {
  let ROOT_HEADER_KEY = "X-Test";
  let ROOT_HEADER_VALUE = "SUCCESS";
  let ACTION_HKEY = "X-Test-Action";
  let ACTION_HVALUE = "SUCCESS";

  let appFixture: Fixture;

  test.beforeAll(async () => {
    appFixture = await createFixture({
      future: { v2_routeConvention: true, v2_errorBoundary: true },
      files: {
        "app/root.jsx": js`
          import { json } from "@remix-run/node";
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export const loader = () => json({});

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/_index.jsx": js`
          import { json } from "@remix-run/node";

          export function loader() {
            return json(null, {
              headers: {
                "${ROOT_HEADER_KEY}": "${ROOT_HEADER_VALUE}"
              }
            })
          }

          export function headers({ loaderHeaders }) {
            return {
              "${ROOT_HEADER_KEY}": loaderHeaders.get("${ROOT_HEADER_KEY}")
            }
          }

          export default function Index() {
            return <div>Heyo!</div>
          }
        `,

        "app/routes/action.jsx": js`
          import { json } from "@remix-run/node";

          export function action() {
            return json(null, {
              headers: {
                "${ACTION_HKEY}": "${ACTION_HVALUE}"
              }
            })
          }

          export function headers({ actionHeaders }) {
            return {
              "${ACTION_HKEY}": actionHeaders.get("${ACTION_HKEY}")
            }
          }

          export default function Action() { return <div/> }
        `,

        "app/routes/parent.jsx": js`
          export function headers({ actionHeaders, errorHeaders, loaderHeaders, parentHeaders }) {
            return new Headers([
              ...(parentHeaders ? Array.from(parentHeaders.entries()) : []),
              ...(actionHeaders ? Array.from(actionHeaders.entries()) : []),
              ...(loaderHeaders ? Array.from(loaderHeaders.entries()) : []),
              ...(errorHeaders ? Array.from(errorHeaders.entries()) : []),
            ]);
          }

          export function loader({ request }) {
            if (new URL(request.url).searchParams.get('throw') === "parent") {
              throw new Response(null, {
                status: 400,
                headers: { 'X-Parent-Loader': 'error' },
              })
            }
            return new Response(null, {
              headers: { 'X-Parent-Loader': 'success' },
            })
          }

          export async function action({ request }) {
            let fd = await request.formData();
            if (fd.get('throw') === "parent") {
              throw new Response(null, {
                status: 400,
                headers: { 'X-Parent-Action': 'error' },
              })
            }
            return new Response(null, {
              headers: { 'X-Parent-Action': 'success' },
            })
          }

          export default function Component() { return <div/> }

          export function ErrorBoundary() {
            return <h1>Error!</h1>
          }
        `,

        "app/routes/parent.child.jsx": js`
          export function headers({ actionHeaders, errorHeaders, loaderHeaders, parentHeaders }) {
            return new Headers([
              ...(parentHeaders ? Array.from(parentHeaders.entries()) : []),
              ...(actionHeaders ? Array.from(actionHeaders.entries()) : []),
              ...(loaderHeaders ? Array.from(loaderHeaders.entries()) : []),
              ...(errorHeaders ? Array.from(errorHeaders.entries()) : []),
            ]);
          }

          export function loader({ request }) {
            if (new URL(request.url).searchParams.get('throw') === "child") {
              throw new Response(null, {
                status: 400,
                headers: { 'X-Child-Loader': 'error' },
              })
            }
            return new Response(null, {
              headers: { 'X-Child-Loader': 'success' },
            })
          }

          export async function action({ request }) {
            let fd = await request.formData();
            if (fd.get('throw') === "child") {
              console.log('throwing from child action')
              throw new Response(null, {
                status: 400,
                headers: { 'X-Child-Action': 'error' },
              })
            }
            console.log('returning from child action')
            return new Response(null, {
              headers: { 'X-Child-Action': 'success' },
            })
          }

          export default function Component() { return <div/> }
        `,

        "app/routes/parent.child.grandchild.jsx": js`
          export function loader({ request }) {
            throw new Response(null, {
              status: 400,
              headers: { 'X-Child-Grandchild': 'error' },
            })
          }

          export default function Component() { return <div/> }
        `,
      },
    });
  });

  test("can use `action` headers", async () => {
    let response = await appFixture.postDocument(
      "/action",
      new URLSearchParams()
    );
    expect(response.headers.get(ACTION_HKEY)).toBe(ACTION_HVALUE);
  });

  test("can use the loader headers when all routes have loaders", async () => {
    let response = await appFixture.requestDocument("/");
    expect(response.headers.get(ROOT_HEADER_KEY)).toBe(ROOT_HEADER_VALUE);
  });

  test("can use the loader headers when parents don't have loaders", async () => {
    let HEADER_KEY = "X-Test";
    let HEADER_VALUE = "SUCCESS";

    let fixture = await createFixture({
      future: { v2_routeConvention: true },
      files: {
        "app/root.jsx": js`
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <Outlet />
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/_index.jsx": js`
          import { json } from "@remix-run/node";

          export function loader() {
            return json(null, {
              headers: {
                "${HEADER_KEY}": "${HEADER_VALUE}"
              }
            })
          }

          export function headers({ loaderHeaders }) {
            return {
              "${HEADER_KEY}": loaderHeaders.get("${HEADER_KEY}")
            }
          }

          export default function Index() {
            return <div>Heyo!</div>
          }
        `,
      },
    });
    let response = await fixture.requestDocument("/");
    expect(response.headers.get(HEADER_KEY)).toBe(HEADER_VALUE);
  });

  test("returns headers from successful /parent GET requests", async () => {
    let response = await appFixture.requestDocument("/parent");
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-parent-loader", "success"],
      ])
    );
  });

  test("returns headers from successful /parent/child GET requests", async () => {
    let response = await appFixture.requestDocument("/parent/child");
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-child-loader", "success"],
        ["x-parent-loader", "success"],
      ])
    );
  });

  test("returns headers from successful /parent POST requests", async () => {
    let response = await appFixture.postDocument(
      "/parent",
      new URLSearchParams()
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-parent-action", "success"],
        ["x-parent-loader", "success"],
      ])
    );
  });

  test("returns headers from successful /parent/child POST requests", async () => {
    let response = await appFixture.postDocument(
      "/parent/child",
      new URLSearchParams()
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-child-action", "success"],
        ["x-child-loader", "success"],
        ["x-parent-loader", "success"],
      ])
    );
  });

  test("returns headers from failed /parent GET requests", async () => {
    let response = await appFixture.requestDocument("/parent?throw=parent");
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-parent-loader", "error, error"], // Shows up in loaderHeaders and errorHeaders
      ])
    );
  });

  test("returns bubbled headers from failed /parent/child GET requests", async () => {
    let response = await appFixture.requestDocument(
      "/parent/child?throw=child"
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-child-loader", "error"],
        ["x-parent-loader", "success"],
      ])
    );
  });

  test("ignores headers from successful non-rendered loaders", async () => {
    let response = await appFixture.requestDocument(
      "/parent/child?throw=parent"
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-parent-loader", "error, error"], // Shows up in loaderHeaders and errorHeaders
      ])
    );
  });

  test("chooses higher thrown errors when multiple loaders throw", async () => {
    let response = await appFixture.requestDocument(
      "/parent/child/grandchild?throw=child"
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-child-loader", "error"],
        ["x-parent-loader", "success"],
      ])
    );
  });

  test("returns headers from failed /parent POST requests", async () => {
    let response = await appFixture.postDocument(
      "/parent?throw=parent",
      new URLSearchParams("throw=parent")
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-parent-action", "error, error"], // Shows up in actionHeaders and errorHeaders
      ])
    );
  });

  test("returns bubbled headers from failed /parent/child POST requests", async () => {
    let response = await appFixture.postDocument(
      "/parent/child",
      new URLSearchParams("throw=child")
    );
    expect(JSON.stringify(Array.from(response.headers.entries()))).toBe(
      JSON.stringify([
        ["content-type", "text/html"],
        ["x-child-action", "error"],
      ])
    );
  });
});
