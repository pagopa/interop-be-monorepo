/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as expressWinston from "express-winston";
import * as winston from "winston";
import { LoggerConfig } from "../config/commonConfig.js";
import { bigIntReplacer } from "./utils.js";

export type SessionMetaData = {
  userId: string | undefined;
  organizationId: string | undefined;
  correlationId: string | undefined | null;
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

export type LoggerCtx = {
  userId?: string;
  organizationId?: string;
  correlationId?: string;
  eventType?: string;
  eventVersion?: number;
  streamId?: string;
};

const logFormat = (
  msg: string,
  timestamp: string,
  level: string,
  {
    userId,
    organizationId,
    correlationId,
    eventType,
    eventVersion,
    streamId,
  }: LoggerCtx,
  serviceName?: string
) => {
  const serviceLogPart = serviceName ? `[${serviceName}]` : undefined;
  const userLogPart = userId ? `[UID=${userId}]` : undefined;
  const organizationLogPart = organizationId
    ? `[OID=${organizationId}]`
    : undefined;
  const correlationLogPart = correlationId
    ? `[CID=${correlationId}]`
    : undefined;
  const eventTypePart = eventType ? `[ET=${eventType}]` : undefined;
  const eventVersionPart = eventVersion ? `[EV=${eventVersion}]` : undefined;
  const streamIdPart = streamId ? `[SID=${streamId}]` : undefined;

  const firstPart = [timestamp, level.toUpperCase(), serviceLogPart]
    .filter((e) => e !== undefined)
    .join(" ");

  const secondPart = [
    userLogPart,
    organizationLogPart,
    correlationLogPart,
    eventTypePart,
    eventVersionPart,
    streamIdPart,
  ]
    .filter((e) => e !== undefined)
    .join(" ");

  return `${firstPart} - ${secondPart} ${msg}`;
};

export const customFormat = (serviceName?: string) =>
  winston.format.printf(({ level, message, timestamp, logCtx }) => {
    const logMetadata = logCtx;
    const clearMessage =
      typeof message === "object"
        ? JSON.stringify(message, bigIntReplacer)
        : message;
    const lines = clearMessage
      .toString()
      .split("\n")
      .map((line: string) =>
        logFormat(line, timestamp, level, logMetadata, serviceName)
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

const logger_internal = getLogger();

export const logger = {
  debug: (
    msg: (typeof logger_internal.debug.arguments)[0],
    logCtx: LoggerCtx
  ) => logger_internal.debug(msg, { logCtx }),
  info: (msg: (typeof logger_internal.info.arguments)[0], logCtx: LoggerCtx) =>
    logger_internal.info(msg, { logCtx }),
  warn: (msg: (typeof logger_internal.warn.arguments)[0], logCtx: LoggerCtx) =>
    logger_internal.warn(msg, { logCtx }),
  error: (
    msg: (typeof logger_internal.error.arguments)[0],
    logCtx: LoggerCtx
  ) => logger_internal.error(msg, { logCtx }),
};

if (!parsedLoggerConfig.success) {
  // eslint-disable-next-line no-console
  console.log(
    `No LOG_LEVEL env var: defaulting log level to "${config.logLevel}"`
  );
}
