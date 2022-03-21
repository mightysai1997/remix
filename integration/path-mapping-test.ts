import { createAppFixture, createFixture, js, json } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

let fixture: Fixture;
let app: AppFixture;

beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/components/my-lib/index.ts": js`
        export const pizza = "this is a pizza";
      `,

      "app/routes/index.tsx": js`
        import { pizza } from "@mylib";
        import { json, useLoaderData, Link } from "remix";

        export function loader() {
          return json(pizza);
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              {data}
            </div>
          )
        }
      `,
      
      "app/routes/tilde-alias.tsx": js`
        import { pizza } from "~/components/my-lib";
        import { json, useLoaderData, Link } from "remix";

        export function loader() {
          return json(pizza);
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              {data}
            </div>
          )
        }
      `,

      "tsconfig.json": json`
        {
          "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
          "compilerOptions": {
            "lib": ["DOM", "DOM.Iterable", "ES2019"],
            "isolatedModules": true,
            "esModuleInterop": true,
            "jsx": "react-jsx",
            "moduleResolution": "node",
            "resolveJsonModule": true,
            "target": "ES2019",
            "strict": true,
            "baseUrl": ".",
            "paths": {
              "~/*": ["./app/*"],
              "@mylib": ["./app/components/my-lib/index"]
            },

            // Remix takes care of building everything in \`remix build\`.
            "noEmit": true
          }
        }
      `
    },
  });

  app = await createAppFixture(fixture);
});

afterAll(async () => app.close());

it("import internal library via alias other than ~", async () => {
// test for https://github.com/remix-run/remix/issues/2298
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("this is a pizza");
});

it("import internal library via ~ alias", async () => {
  let response = await fixture.requestDocument("/tilde-alias");
  expect(await response.text()).toMatch("this is a pizza");
});
