import * as express from "express";
import { LoggerMetadata, logger } from "./index.js";

export function loggerMiddleware(serviceName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, res: any, next: express.NextFunction): void => {
    const loggerMetadata: LoggerMetadata = {
      serviceName,
      userId: req.ctx?.authData?.userId,
      organizationId: req.ctx?.authData?.organizationId,
      correlationId: req.ctx?.correlationId,
    };

    const loggerInstance = logger(loggerMetadata);

    next();

    loggerInstance.info(
      `Request ${req.method} ${req.url} - Response ${res.statusCode} ${res.statusMessage}`
    );
  };
}
