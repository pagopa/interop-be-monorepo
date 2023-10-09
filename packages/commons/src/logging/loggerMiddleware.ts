import * as expressWinston from "express-winston";
import * as winston from "winston";
import { config } from "../config/index.js";
import { getContext } from "../index.js";

export type SessionMetaData = {
  userId: string | undefined;
  organizationId: string | undefined;
  correlationId: string | undefined;
};

const getLoggerMetadata = (): SessionMetaData => {
  const appContext = getContext();
  return !appContext
    ? {
        userId: "",
        organizationId: "",
        correlationId: "",
      }
    : {
        userId: appContext.authData.userId,
        organizationId: appContext.authData.organizationId,
        correlationId: appContext.correlationId,
      };
};

export const customFormat = winston.format.printf(
  ({ level, message, timestamp }) => {
    const { userId, organizationId, correlationId } = getLoggerMetadata();

    const lines = message
      .split("\n")
      .map(
        (line: string) =>
          `${timestamp} ${level.toUpperCase()} - [UID=${userId}] [OID=${organizationId}] [CID=${correlationId}] ${line}`
      );
    return lines.join("\n");
  }
);

export const logger = winston.createLogger({
  level: config.logLevel,
  transports: [
    new winston.transports.Console({
      stderrLevels: ["error"],
    }),
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.errors({ stack: true }),
    customFormat
  ),
  silent: process.env.NODE_ENV === "test",
});

export const loggerMiddleware = expressWinston.logger({
  winstonInstance: logger,
  requestWhitelist:
    config.logLevel === "debug" ? ["body", "headers", "query"] : [],
  ignoredRoutes: ["/status"],
  responseWhitelist:
    config.logLevel === "debug" ? ["body", "statusCode", "statusMessage"] : [],
});
