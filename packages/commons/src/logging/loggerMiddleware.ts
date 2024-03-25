/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as expressWinston from "express-winston";
import * as winston from "winston";
import { LoggerConfig } from "../config/commonConfig.js";
import { getContext } from "../index.js";

export type SessionMetaData = {
  userId: string | undefined;
  organizationId: string | undefined;
  correlationId: string | undefined;
  eventType: string | undefined;
  eventVersion: number | undefined;
  streamId: string | undefined;
};

export const parsedLoggerConfig = LoggerConfig.safeParse(process.env);
const config: LoggerConfig = parsedLoggerConfig.success
  ? parsedLoggerConfig.data
  : {
      logLevel: "info",
    };

const getLoggerMetadata = (): SessionMetaData => {
  const appContext = getContext();
  return !appContext
    ? {
        userId: undefined,
        organizationId: undefined,
        correlationId: undefined,
        eventType: undefined,
        eventVersion: undefined,
        streamId: undefined,
      }
    : {
        userId: appContext.authData?.userId,
        organizationId: appContext.authData?.organizationId,
        correlationId: appContext.correlationId,
        eventType: appContext.messageData?.eventType,
        eventVersion: appContext.messageData?.eventVersion,
        streamId: appContext.messageData?.streamId,
      };
};

const logFormat = (
  msg: string,
  timestamp: string,
  level: string,
  {
    userId,
    organizationId,
    correlationId,
    serviceName,
  }: {
    userId: string | undefined;
    organizationId: string | undefined;
    correlationId: string | undefined;
    serviceName: string | undefined;
  }
) => {
  const serviceLogPart = serviceName ? `[${serviceName}]` : "";
  const userLogPart = userId ? `[UID=${userId}]` : "";
  const organizationLogPart = organizationId ? `[OID=${organizationId}]` : "";
  const correlationLogPart = correlationId ? `[CID=${correlationId}]` : "";

  return `${timestamp} ${level.toUpperCase()} ${serviceLogPart} - ${userLogPart} ${organizationLogPart} ${correlationLogPart} ${msg}`;
};

export const customFormat = (serviceName?: string) =>
  winston.format.printf(({ level, message, timestamp }) => {
    const logMetadata = getLoggerMetadata();
    const lines = message
      .toString()
      .split("\n")
      .map((line: string) =>
        logFormat(line, timestamp, level, { ...logMetadata, serviceName })
      );
    return lines.join("\n");
  });

const getLogger = (serviceName?: string) =>
  winston.createLogger({
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
      customFormat(serviceName)
    ),
    silent: process.env.NODE_ENV === "test",
  });

export const loggerMiddleware = (serviceName: string) => () =>
  expressWinston.logger({
    winstonInstance: getLogger(serviceName),
    requestWhitelist:
      config.logLevel === "info" ? ["body", "headers", "query"] : [],
    ignoredRoutes: ["/status"],
    responseWhitelist:
      config.logLevel === "info" ? ["body", "statusCode", "statusMessage"] : [],
    meta: false,
    msg: (req, res) =>
      `Request ${req.method} ${req.url} - Response ${res.statusCode} ${res.statusMessage}`,
  });

export const logger = getLogger();
if (!parsedLoggerConfig.success) {
  // eslint-disable-next-line no-console
  console.log(
    `No LOG_LEVEL env var: defaulting log level to "${config.logLevel}"`
  );
}
