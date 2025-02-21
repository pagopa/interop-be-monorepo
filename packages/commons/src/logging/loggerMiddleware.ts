/* eslint-disable @typescript-eslint/no-explicit-any */
import * as express from "express";
import { AppContext } from "../context/context.js";
import { LoggerMetadata, logger } from "./index.js";

export function loggerMiddleware(serviceName: string): express.RequestHandler {
  return (req, res, next): void => {
    res.on("finish", () => {
      const context = (req as express.Request & { ctx?: AppContext }).ctx;

      const loggerMetadata: LoggerMetadata = {
        serviceName,
        userId: context?.authData?.userId,
        organizationId: context?.authData?.organizationId,
        correlationId: context?.correlationId,
      };

      const loggerInstance = logger(loggerMetadata);
      const msg = `Request ${req.method} ${req.url} - Response ${res.statusCode} ${res.statusMessage}`;
      if (req.url === "/status") {
        loggerInstance.debug(msg);
      } else {
        loggerInstance.info(msg);
      }
    });

    next();
  };
}
