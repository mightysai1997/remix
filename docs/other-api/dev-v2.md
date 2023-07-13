---
title: "@remix-run/dev CLI (v2)"
order: 2
new: true
---

# Remix CLI (v2)

The Remix CLI comes from the `@remix-run/dev` package. It also includes the compiler. Make sure it is in your `package.json` `devDependencies` so it doesn't get deployed to your server.

To get a full list of available commands and flags, run:

```sh
npx @remix-run/dev -h
```

## `remix build`

Builds your app for production. This command will set `process.env.NODE_ENV` to `production` and minify the output for deployment.

```sh
remix build
```

### Options

| Option                                   | flag          | config | default |
| ---------------------------------------- | ------------- | ------ | ------- |
| Generate sourcemaps for production build | `--sourcemap` | N/A    | `false` |

## `remix dev`

Builds your app and spins up the Remix dev server alongside your app server.

The dev server will:

1. Set `NODE_ENV` to `development`
2. Watch your app code for changes and trigger rebuilds
3. Restart your app server whenever rebuilds succeed
4. Send code updates to the browser via Live Reload and HMR + Hot Data Revalidation

<docs-info>

What is "Hot Data Revalidation"?

Like HMR, HDR is a way of hot updating your app without needing to refresh the page.
That way you can keep your app state as your edits are applied in your app.
HMR handles client-side code updates like when you change the components, markup, or styles in your app.
Likewise, HDR handles server-side code updates.

That means any time your change a `loader` on your current page (or any code that your `loader` depends on), Remix will re-fetch data from your changed loader.
That way your app is _always_ up-to-date with the latest code changes, client-side or server-side.

To learn more about how HMR and HDR work together, check out [Pedro's talk at Remix Conf 2023][legendary-dx].

</docs-info>

### With `remix-serve`

Enable the v2 dev server:

```js filename=remix.config.js
module.exports = {
  future: {
    v2_dev: true,
  },
};
```

That's it!

### With custom app server

If you used a template to get started, hopefully it has integration with the v2 dev server out-of-the-box.
If not, you can follow these steps to integrate your project with `v2_dev`:

1. Enable the v2 dev server:

```js filename=remix.config.js
module.exports = {
  future: {
    v2_dev: true,
  },
};
```

2. Replace your dev scripts in `package.json` and use `-c` to specify your app server command:

```json
{
  "dev": "remix dev -c 'node ./server.js'"
}
```

3. Ensure `broadcastDevReady` is called when your app server is up and running:

```js filename=server.js lines=[12,25-27]
import path from "node:path";

import { broadcastDevReady } from "@remix-run/node";
import express from "express";

const BUILD_DIR = path.resolve(__dirname, "build");
const build = require(BUILD_DIR);

const app = express();

// ... code for setting up your express app goes here ...

app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  })
);

const port = 3000;
app.listen(port, () => {
  console.log(`👉 http://localhost:${port}`);

  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});
```

<docs-info>

For CloudFlare, use `logDevReady` instead of `broadcastDevReady`.

Why? `broadcastDevReady` uses `fetch` to send a ready message to the dev server,
but CloudFlare does not support async I/O like `fetch` outside of request handling.

</docs-info>

### Options

Options priority order is: 1. flags, 2. config, 3. defaults.

| Option          | flag               | config    | default                           | description                                                |
| --------------- | ------------------ | --------- | --------------------------------- | ---------------------------------------------------------- |
| Command         | `-c` / `--command` | `command` | `remix-serve <server build path>` | Command the dev server will run to spin up your app server |
| Manual          | `--manual`         | `manual`  | `false`                           | See [guide for manual mode](../guides/manual-mode)         |
| Port            | `--port`           | `port`    | Dynamically chosen open port      | Internal port used for hot updates                         |
| TLS key         | `--tls-key`        | `tlsKey`  | N/A                               | TLS key for configuring local HTTPS                        |
| TLS certificate | `--tls-cert`       | `tlsCert` | N/A                               | TLS certificate for configuring local HTTPS                |

<docs-info>

The port option only affects the Remix dev server, and **does not affect your app server**.
Your app will run on your app server's normal URL.

You probably don't want to configure the port for the dev server,
as it is an implementation detail used internally for hot updates.
The port option exists in case you need fine-grain networking control,
for example to setup Docker networking or use a specific open port for security purposes.

</docs-info>

For example, to override the internal port used by the dev server via config:

```js filename=remix.config.js
module.exports = {
  future: {
    v2_dev: {
      port: 8001,
    },
  },
};
```

### Pick up changes from other packages

If you are using a monorepo, you might want Remix to perform hot updates not only when your app code changes, but whenever you change code in any of your apps dependencies.

For example, you could have a UI library package (`packages/ui`) that is used within your Remix app (`packages/app`).
To pick up changes in `packages/ui`, you can configure [watchPaths][watch-paths] to include your packages.

### How to set up MSW

To use [Mock Service Worker][msw] in development, you'll need to:

1. Run MSW as part of your app server
2. Configure MSW to not mock internal "dev ready" messages to the dev server

`remix dev` will provide the `REMIX_DEV_ORIGIN` environment variable for use in your app server.

For example, if you are using [binode][binode] to integrate with MSW,
make sure that the call to `binode` is within the `remix dev -c` subcommand.
That way, the MSW server will have access to the `REMIX_DEV_ORIGIN` environment variable:

```json filename=package.json
{
  "scripts": {
    "dev": "remix dev -c 'npm run dev:app'",
    "dev:app": "binode --require ./mocks -- @remix-run/serve:remix-serve ./build"
  }
}
```

Next, you can use `REMIX_DEV_ORIGIN` to let MSW forward internal "dev ready" messages on `/ping`:

```ts
import { rest } from "msw";

const REMIX_DEV_PING = new URL(
  process.env.REMIX_DEV_ORIGIN
);
REMIX_DEV_PING.pathname = "/ping";

export const server = setupServer(
  rest.post(REMIX_DEV_PING.href, (req) => req.passthrough())
  // ... other request handlers go here ...
);
```

### How to set up local HTTPS

For this example, let's use [mkcert][mkcert].
After you have it installed, make sure to:

- Create a local Certificate Authority if you haven't already done so
- Use `NODE_EXTRA_CA_CERTS` for Node compatibility

```sh
mkcert -install # create a local CA
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" # tell Node to use our local CA
```

Now, create the TLS key and certificate:

```sh
mkcert -key-file key.pem -cert-file cert.pem localhost
```

👆 You can change `localhost` to something else if you are using custom hostnames.

Next, use the `key.pem` and `cert.pem` to get HTTPS working locally with your app server.
This depends on what you are using for your app server.
For example, here's how you could use HTTPS with an Express server:

```ts filename=server.js
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

import express from "express";

const BUILD_DIR = path.resolve(__dirname, "build");
const build = require(BUILD_DIR);

const app = express();

// ... code setting up your express app goes here ...

const server = https.createServer(
  {
    key: fs.readFileSync("path/to/key.pem"),
    cert: fs.readFileSync("path/to/cert.pem"),
  },
  app
);

const port = 3000;
server.listen(port, () => {
  console.log(`👉 https://localhost:${port}`);

  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});
```

Now that the app server is set up, you should be able to build and run your app in production mode with TLS.
To get the dev server to interop with TLS, you'll need to specify the TLS cert and key you created:

```sh
remix dev --tls-key=key.pem --tls-cert=cert.pem -c 'node ./server.js'
```

Alternatively, you can specify the TLS key and cert via the `v2_dev.tlsCert` and `v2_dev.tlsKey` config options.
Now your app server and dev server are TLS ready!

### How to integrate with a reverse proxy

Let's say you have the app server and dev server both running on the same machine:

- App server 👉 `http://localhost:1234`
- Dev server 👉 `http://localhost:5678`

Then, you setup a reverse proxy in front of the app server and dev server:

- Reverse proxy 👉 `https://myhost`

But the internal HTTP and WebSocket connections to support hot updates will still try to reach the dev server's unproxied origin:

- Hot updates 👉 `http://localhost:5678` / `ws://localhost:5678` ❌

To get the internal connections to point to the reverse proxy, you can use the `REMIX_DEV_ORIGIN` environment variable:

```sh
REMIX_DEV_ORIGIN=https://myhost remix dev
```

Now, hot updates will be sent correctly to the proxy:

- Hot updates 👉 `https://myhost` / `wss://myhost` ✅

### Performance tuning and debugging

#### Path imports

Currently, when Remix rebuilds your app, the compiler has to process your app code along with any of its dependencies.
The compiler treeshakes unused code from app so that you don't ship any unused code to browser and so that you keep your server as slim as possible.
But the compiler still needs to _crawl_ all the code to know what to keep and what to treeshake away.

In short, this means that the way you do imports and exports can have a big impact on how long it takes to rebuild your app.
For example, if you are using a library like Material UI or AntD you can likely speed up your builds by using [path imports][path-imports]:

```diff
- import { Button, TextField } from '@mui/material';
+ import Button from '@mui/material/Button';
+ import TextField from '@mui/material/TextField';
```

In the future, Remix could pre-bundle dependencies in development to avoid this problem entirely.
But today, you can help the compiler out by using path imports.

#### Debugging bundles

Dependending on your app and dependencies, you might be processing much more code than your app needs.
Check out our [bundle analysis guide][bundle-analysis] for more details.

### Troubleshooting

#### HMR: hot updates losing app state

Hot Module Replacement is supposed to keep your app's state around between hot updates.
But in some cases React cannot distinguish between existing components being changed and new components being added.
[React needs `key`s][react-keys] to disambiguate these cases and track changes when sibling elements are modified.

Additionally, when adding or removing hooks, React Refresh treats that as a brand new component. So if you add `useLoaderData` to your component, you may lose state local to that component.

These are limitations of React and [React Refresh][react-refresh], not Remix.

#### HDR: every code change triggers HDR

Hot Data Revalidation detects loader changes by trying to bundle each loader and then fingerprinting the content for each.
It relies on treeshaking to determine whether your changes affect each loader or not.

To ensure that treeshaking can reliably detect changes to loaders, make sure you declare that your app's package is side-effect free:

```json filename=package.json
{
  "sideEffects": false
}
```

#### HDR: harmless console errors when loader data is removed

When you delete a loader or remove some of the data being returned by that loader, your app should be hot updated correctly.
But you may notice console errors logged in your browser.

React strict-mode and React Suspense can cause multiple renders when hot updates are applied.
Most of these render correctly, including the final render that is visible to you.
But intermediate renders can sometimes use new loader data with old React components, which is where those errors come from.

We are continuing to investigate the underlying race condition to see if we can smooth that over.
In the meantime, if those console errors bother you, you can refresh the page whenever they occur.

#### HDR: performance

When the v2 dev server builds (and rebuilds) your app, you may notice a slight slowdown as the dev server needs to crawl the dependencies for each loader.
That way the dev server can detect loader changes on rebuilds.

While the initial build slowdown is inherently a cost for HDR, we plan to optimize rebuilds so that there is no perceivable slowdown for HDR rebuilds.

[legendary-dx]: https://www.youtube.com/watch?v=79M4vYZi-po
[watch-paths]: https://remix.run/docs/en/1.17.1/file-conventions/remix-config#watchpaths
[react-keys]: https://react.dev/learn/rendering-lists#why-does-react-need-keys
[react-refresh]: https://github.com/facebook/react/tree/main/packages/react-refresh
[binode]: https://github.com/kentcdodds/binode
[msw]: https://mswjs.io/
[mkcert]: https://github.com/FiloSottile/mkcert
[path-imports]: https://mui.com/material-ui/guides/minimizing-bundle-size/#option-one-use-path-imports
[bundle-analysis]: ../guides/performance
