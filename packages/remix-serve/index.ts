import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export function createApp(buildPath: string, mode = "production") {
  let app = express();

  app.use(compression());
  app.use(express.static("public", { immutable: true, maxAge: "1h" }));

  app.use(morgan("tiny"));
  app.all(
    "*",
    mode === "production"
      ? createRequestHandler({ build: require(buildPath), mode })
      : (req, res, next) => {
          // require cache is purged in @remix-run/dev where the file watcher is
          let build = require(buildPath);
          return createRequestHandler({ build, mode })(req, res, next);
        }
  );

  return app;
}
