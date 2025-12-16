/* eslint-disable @typescript-eslint/explicit-function-return-type */
import winston from "winston";
import { CorrelationId, SpanId } from "pagopa-interop-models";
import { LoggerConfig } from "../config/loggerConfig.js";
import { bigIntReplacer } from "./utils.js";

export type LoggerMetadata = {
  serviceName?: string;
  userId?: string;
  organizationId?: string;
  correlationId?: CorrelationId | null;
  spanId?: SpanId | null;
  eventType?: string;
  eventVersion?: number;
  streamId?: string;
  streamVersion?: number;
  jti?: string;
};

export const parsedLoggerConfig = LoggerConfig.safeParse(process.env);
const config: LoggerConfig = parsedLoggerConfig.success
  ? parsedLoggerConfig.data
  : {
      logLevel: "info",
    };

const logFormat = (
  msg: string,
  timestamp: string,
  level: string,
  {
    serviceName,
    userId,
    organizationId,
    correlationId,
    spanId,
    eventType,
    eventVersion,
    streamId,
    streamVersion,
    jti,
  }: LoggerMetadata
) => {
  const serviceLogPart = serviceName ? `[${serviceName}]` : undefined;
  const userLogPart = userId ? `[UID=${userId}]` : undefined;
  const organizationLogPart = organizationId
    ? `[OID=${organizationId}]`
    : undefined;
  const jtiLogPart = jti ? `[JTI=${jti}]` : undefined;
  const correlationLogPart = correlationId
    ? `[CID=${correlationId}]`
    : undefined;
  const spanIdLogPart = spanId ? `[SPANID=${spanId}]` : undefined;
  const eventTypePart = eventType ? `[ET=${eventType}]` : undefined;
  const eventVersionPart = eventVersion ? `[EV=${eventVersion}]` : undefined;
  const streamVersionPart = streamVersion ? `[SV=${streamVersion}]` : undefined;
  const streamIdPart = streamId ? `[SID=${streamId}]` : undefined;

  const firstPart = [timestamp, level.toUpperCase(), serviceLogPart]
    .filter((e) => e !== undefined)
    .join(" ");

  const secondPart = [
    userLogPart,
    organizationLogPart,
    correlationLogPart,
    jtiLogPart,
    spanIdLogPart,
    eventTypePart,
    eventVersionPart,
    streamVersionPart,
    streamIdPart,
  ]
    .filter((e) => e !== undefined)
    .join(" ");

  return `${firstPart} - ${secondPart} ${msg}`;
};

export const customFormat = () =>
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const clearMessage =
      typeof message === "object"
        ? JSON.stringify(message, bigIntReplacer)
        : message;
    const lines = clearMessage
      .toString()
      .split("\n")
      .map((line: string) =>
        logFormat(line, timestamp, level, meta.loggerMetadata)
      );
    return lines.join("\n");
  });

const getLogger = () =>
  winston.createLogger({
    level: config.logLevel,
    transports: [
      new winston.transports.Console({
        stderrLevels: ["error"],
        forceConsole: true,
      }),
    ],
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.errors({ stack: true }),
      customFormat()
    ),
    silent: process.env.NODE_ENV === "test",
  });

const internalLoggerInstance = getLogger();

export const logger = (loggerMetadata: LoggerMetadata) => ({
  isDebugEnabled: () => internalLoggerInstance.isDebugEnabled(),
  debug: (msg: (typeof internalLoggerInstance.debug.arguments)[0]) =>
    internalLoggerInstance.debug(msg, { loggerMetadata }),
  info: (msg: (typeof internalLoggerInstance.info.arguments)[0]) =>
    internalLoggerInstance.info(msg, { loggerMetadata }),
  warn: (msg: (typeof internalLoggerInstance.warn.arguments)[0]) =>
    internalLoggerInstance.warn(msg, { loggerMetadata }),
  error: (msg: (typeof internalLoggerInstance.error.arguments)[0]) =>
    internalLoggerInstance.error(msg, { loggerMetadata }),
});

export type Logger = ReturnType<typeof logger>;

export const genericLogger = logger({});

export * from "./loggerMiddleware.js";

if (!parsedLoggerConfig.success) {
  // eslint-disable-next-line no-console
  console.log(
    `No LOG_LEVEL env var: defaulting log level to "${config.logLevel}"`
  );
}
