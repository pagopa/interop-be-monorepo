import * as expressWinston from "express-winston";
import * as winston from "winston";
import { config } from "../config/index.js";
import { readHeaders } from "../index.js";

export const customFormat = winston.format.printf(
  ({ level, message, timestamp, reference, meta }) => {
    const lines = message
      .split("\n")
      .map(
        (line: string) =>
          `${timestamp} ${level.toUpperCase()} [${reference}] - [UID=${
            meta?.userId
          }] [OID=${meta?.organizationId}] [CID=${meta?.correlationId}] ${line}`
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
  meta: true,
  dynamicMeta: (req) => (req ? { ...readHeaders(req) } : {}),
  requestWhitelist:
    config.logLevel === "debug" ? ["body", "headers", "query"] : [],
  ignoredRoutes: ["/status"],
  responseWhitelist:
    config.logLevel === "debug" ? ["body", "statusCode", "statusMessage"] : [],
});
