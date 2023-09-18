---
title: "Local TLS"
---

# Local TLS

It's simpler to use HTTP locally, but if you really need to use HTTPS locally, here's how to do it.

<docs-warning>

`remix-serve` does not support local HTTPS as its meant to be a minimal server to get you off the ground.
`remix-serve` is a simple wrapper around Express, so you can use Express directly if you want to use HTTPS locally.

If you are running `remix dev` without the `-c` flag, you are implicitly using `remix-serve` as your app server.

</docs-warning>

## Running your app server with local TLS

The first step is to get your app server running with local TLS _without_ running `remix dev`.
That will set you up for success when you setup `remix dev` with local TLS in the next section.

👉 Install [mkcert][mkcert]

👉 Create a local Certificate Authority:

```sh
mkcert -install
```

👉 Tell Node to use our local CA:

```sh
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
```

👉 Create a TLS key and certificate:

```
mkcert -key-file key.pem -cert-file cert.pem localhost
```

<docs-info>

You can change `localhost` to something else when generating TLS keys and certificates if you are using custom hostnames.

</docs-info>

👉 Use the `key.pem` and `cert.pem` to get HTTPS working locally with your app server.

How you do this will depend on what app server you are using.
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
  // ... code to run after your server is running goes here ...
});
```

👉 Run your app server with local TLS

For example, with the Express server above, you would run it like this:

```sh
remix build
node ./server.js
```

## Running `remix dev` with local TLS

Make sure you can run your app with local TLS without `remix dev` first!
Check out the previous section if you haven't done that yet.

👉 Enable TLS for `remix dev`

Via config:

```js filename=remix.config.js
module.exports = {
  dev: {
    tlsKey: "key.pem", // relative to cwd
    tlsCert: "cert.pem", // relative to cwd
  },
};
```

or via flags:

```sh
remix dev --tls-key=key.pem --tls-cert=cert.pem -c "node ./server.js"
```

Your app should now be running with local TLS!

[mkcert]: https://github.com/FiloSottile/mkcert#installation
