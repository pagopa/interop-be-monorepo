import * as express from "express";
import { LoggerMetadata, logger } from "./index.js";

export function loggerMiddleware(serviceName: string) {
  return (req: any, res: any, next: express.NextFunction): void => {
    const loggerMetadata: LoggerMetadata = {
      serviceName,
      userId: req.ctx?.authData?.userId,
      organizationId: req.ctx?.authData?.organizationId,
      correlationId: req.ctx?.correlationId,
    };

    const loggerInstance = logger(loggerMetadata);

    loggerInstance.info(`Request ${req.method} ${req.url}`);
    res.on("finish", () => {
      loggerInstance.info(`Response ${res.statusCode} ${res.statusMessage}`);
    });

    next();
  };
}
