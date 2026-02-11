import { Server } from "http";
import { Application } from "express";
import { ZodiosApp } from "@zodios/express";
import { ExpressContext } from "../context/context.js";
import { genericLogger } from "../logging/index.js";

export function startServer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: ZodiosApp<any, ExpressContext> | Application,
  config: {
    host: string;
    port: number;
    keepAliveTimeout: number;
  }
): Server {
  const server = app.listen(config.port, config.host, () => {
    genericLogger.info(`Listening on ${config.host}:${config.port}`);
  });

  // eslint-disable-next-line functional/immutable-data
  server.keepAliveTimeout = config.keepAliveTimeout;

  return server;
}
