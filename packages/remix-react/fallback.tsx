import * as React from "react";

import { Scripts } from "./components";

// If the user sets `clientLoader.hydrate=true` somewhere but does not
// provide a `HydrateFallback` at any level of the tree, then we need to at
// least include `<Scripts>` in the SSR so we can hydrate the app and call the
// `clientLoader` functions
export function RemixRootDefaultHydrateFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
      </head>
      <body>
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log(
                "💿 Hey developer 👋. You can provide a way better UX than this " +
                "when your app is running \`clientLoader\` functions on hydration. " +
                "Check out https://remix.run/route/hydrate-fallback for more information."
              );
            `,
          }}
        />{" "}
      </body>
    </html>
  );
}
