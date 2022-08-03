import { test, expect } from "@playwright/test";

import { createFixture, createAppFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

test.describe("redirects", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/routes/action.jsx": js`
          import { Outlet, useLoaderData } from "@remix-run/react";

          if (typeof global.actionCount === "undefined") {
            global.actionCount = 0;
          }

          export async function loader({ request }) {
            return { count: ++global.actionCount };
          };

          export default function Parent() {
            let data = useLoaderData();
            return (
              <div id="app">
                <p id="count">{data.count}</p>
                <Outlet/>
              </div>
            );
          }
        `,

        [`app/routes/action/form.jsx`]: js`
          import { redirect } from "@remix-run/node";
          import { Form } from "@remix-run/react";

          export async function action({ request }) {
            return redirect("/action/1");
          };

          export default function Login() {
            return (
              <Form method="post">
                <button type="submit">Submit</button>
              </Form>
            );
          }
        `,

        [`app/routes/action/1.jsx`]: js`
          import { redirect } from "@remix-run/node";

          export async function loader({ request }) {
            return redirect("/action/2");
          };
        `,

        [`app/routes/action/2.jsx`]: js`
          export default function () {
            return <h1>Page 2</h1>
          }
        `,

        "app/session.server.js": js`
          import { createCookie } from "@remix-run/node";
          export const session = createCookie("session");
        `,

        "app/routes/loader.jsx": js`
          import { Outlet, useLoaderData } from "@remix-run/react";
          import { session } from "~/session.server";

          if (typeof global.loaderCount === "undefined") {
            global.loaderCount = 0;
          }

          export async function loader({ request }) {
            const cookieHeader = request.headers.get("Cookie");
            const { value } = (await session.parse(cookieHeader)) || {};
            return { count: ++global.loaderCount, value };
          };

          export default function Parent() {
            let data = useLoaderData();
            return (
              <div id="app">
                <p id="count">{data.count}</p>
                {data.value ? <p>{data.value}</p> : null}
                <Outlet/>
              </div>
            );
          }
        `,

        "app/routes/loader/link.jsx": js`
          import { Link } from "@remix-run/react";
          export default function Parent() {
            return <Link to="/loader/redirect">Redirect</Link>;
          }
        `,

        [`app/routes/loader/redirect.jsx`]: js`
            import { redirect } from "@remix-run/node";
            import { Form } from "@remix-run/react";
            import { session } from "~/session.server";

            export async function loader({ request }) {
              const cookieHeader = request.headers.get("Cookie");
              const cookie = (await session.parse(cookieHeader)) || {};
              cookie.value = 'cookie-value';
              return redirect("/loader/1", {
                headers: {
                  "Set-Cookie": await session.serialize(cookie),
                },
              });
            };
        `,

        [`app/routes/loader/1.jsx`]: js`
          import { redirect } from "@remix-run/node";

          export async function loader({ request }) {
            return redirect("/loader/2");
          };
        `,

        [`app/routes/loader/2.jsx`]: js`
          export default function () {
            return <h1>Page 2</h1>
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  test("preserves revalidation across action multi-redirects", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(`/action/form`);
    expect(await app.getHtml("#count")).toMatch("1");
    // Submitting this form will trigger an action -> redirect -> redirect
    // and we need to ensure that the parent loader is called on both redirects
    await app.clickElement('button[type="submit"]');
    expect(await app.getHtml("#app")).toMatch("Page 2");
    // Loader called twice
    expect(await app.getHtml("#count")).toMatch("3");
  });

  test("preserves revalidation across loader multi-redirects with cookies set", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(`/loader/link`);
    expect(await app.getHtml("#count")).toMatch("1");
    // Clicking this link will trigger a normalRedirect -> normalRedirect with
    // a cookie set on the first one, and we need to ensure that the parent
    // loader is called on both redirects
    await app.clickElement('a[href="/loader/redirect"]');
    expect(await app.getHtml("#app")).toMatch("Page 2");
    expect(await app.getHtml("#app")).toMatch("cookie-value");
    // Loader called twice
    expect(await app.getHtml("#count")).toMatch("3");
  });
});
