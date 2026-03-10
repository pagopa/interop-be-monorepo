/* eslint-disable @typescript-eslint/no-explicit-any */
import * as express from "express";
import { AppContext } from "../context/context.js";
import { getUserInfoFromAuthData } from "../auth/authData.js";
import { LoggerMetadata, logger } from "../logging/index.js";

export function loggerMiddleware(serviceName: string): express.RequestHandler {
  return (req, res, next): void => {
    res.on("finish", () => {
      const context = (req as express.Request & { ctx?: AppContext }).ctx;

      const { userId, organizationId } = getUserInfoFromAuthData(
        context?.authData
      );

      const loggerMetadata: LoggerMetadata = {
        serviceName,
        userId,
        organizationId,
        correlationId: context?.correlationId,
        jti: context?.authData?.jti,
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
