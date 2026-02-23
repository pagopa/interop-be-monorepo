/* eslint-disable sonarjs/cognitive-complexity */
import { RequestHandler, Request } from "express";
import { initProducer } from "kafka-iam-auth";
import {
  ApplicationAuditBeginRequest,
  ApplicationAuditEndRequest,
  ApplicationAuditEndRequestSessionTokenExchange,
  ApplicationAuditEndRequestAuthServer,
  ApplicationAuditPhase,
  fallbackApplicationAuditingFailed,
  genericInternalError,
  kafkaApplicationAuditingFailed,
} from "pagopa-interop-models";
import {
  AppContext,
  ApplicationAuditProducerConfig,
  AuthData,
  AuthServerAppContext,
  decodeJwtToken,
  fromAppContext,
  getUserInfoFromAuthData,
  initQueueManager,
  isFeatureFlagEnabled,
  JWTConfig,
  logger,
  Logger,
  QueueManager,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
import { z } from "zod";

export function parseAmznTraceIdHeader(req: Request): string | undefined {
  const parsed = z
    .object({ "x-amzn-trace-id": z.string() })
    .safeParse(req.headers);

  if (parsed.success) {
    return parsed.data["x-amzn-trace-id"];
  }
  return undefined;
}

export function parseForwardedForHeader(req: Request): string | undefined {
  const parsed = z
    .object({ "x-forwarded-for": z.string() })
    .safeParse(req.headers);

  if (parsed.success) {
    return parsed.data["x-forwarded-for"];
  }
  return undefined;
}

export async function applicationAuditBeginMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  const queueManager = initQueueManager({
    messageGroupId: "message_group_all_notification",
    logLevel: config.logLevel,
  });

  return async (req, _, next): Promise<void> => {
    const requestTimestamp = Date.now();

    const context = (req as Request & { ctx?: AppContext }).ctx;
    if (!context) {
      throw genericInternalError("Failed to retrieve context");
    }

    const loggerInstance = logger({
      serviceName: context?.serviceName,
      correlationId: context?.correlationId,
      spanId: context?.spanId,
    });

    loggerInstance.debug(`Application auditing begin middleware`);

    // eslint-disable-next-line functional/immutable-data
    context.requestTimestamp = requestTimestamp;

    const correlationId = context.correlationId;
    const amznTraceId = parseAmznTraceIdHeader(req);
    const forwardedFor = parseForwardedForHeader(req);

    const initialAudit: ApplicationAuditBeginRequest = {
      correlationId,
      spanId: context.spanId,
      service: serviceName,
      serviceVersion: config.serviceVersion,
      endpoint: req.path,
      httpMethod: req.method,
      phase: ApplicationAuditPhase.BEGIN_REQUEST,
      requesterIpAddress: forwardedFor,
      nodeIp: config.nodeIp,
      podName: config.podName,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: requestTimestamp,
      amazonTraceId: amznTraceId,
    };

    try {
      const res = await producer.send({
        messages: [
          {
            key: correlationId,
            value: JSON.stringify(initialAudit),
          },
        ],
      });
      if (res.length === 0 || res[0].errorCode !== 0) {
        loggerInstance.warn(
          `Kafka producer send response not successful. Details: ${
            res.length === 0
              ? "Empty response"
              : `Error code: ${res[0].errorCode}`
          }`
        );
        throw kafkaApplicationAuditingFailed();
      }
    } catch (e) {
      loggerInstance.warn(
        `Initializing fallback SQS for application auditing begin middleware. Error: ${e}`
      );
      await fallbackApplicationAudit(
        queueManager,
        config,
        config.producerQueueUrl,
        initialAudit,
        loggerInstance
      );
    }

    return next();
  };
}

export async function applicationAuditEndMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  const queueManager = initQueueManager({
    messageGroupId: "message_group_all_notification",
    logLevel: config.logLevel,
  });

  return async (req, res, next): Promise<void> => {
    if (req.path !== "/session/tokens") {
      res.on("finish", async () => {
        const context = (req as Request & { ctx?: AppContext }).ctx;
        if (!context) {
          throw genericInternalError("Failed to retrieve context");
        }

        const loggerInstance = logger({
          serviceName: context?.serviceName,
          correlationId: context?.correlationId,
          spanId: context?.spanId,
        });

        loggerInstance.debug(`Application auditing end middleware`);

        const correlationId = context.correlationId;
        const amznTraceId = parseAmznTraceIdHeader(req);
        const forwardedFor = parseForwardedForHeader(req);

        const endTimestamp = Date.now();

        const { organizationId, userId } = getUserInfoFromAuthData(
          context.authData
        );

        const finalAudit: ApplicationAuditEndRequest = {
          correlationId,
          spanId: context.spanId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.route?.path || req.path, // fallback because "req.route.path" is only available after entering the application router
          httpMethod: req.method,
          phase: ApplicationAuditPhase.END_REQUEST,
          requesterIpAddress: forwardedFor,
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: endTimestamp,
          amazonTraceId: amznTraceId,
          organizationId,
          userId,
          httpResponseStatus: res.statusCode,
          executionTimeMs: endTimestamp - context.requestTimestamp,
        };

        try {
          const res = await producer.send({
            messages: [
              {
                key: correlationId,
                value: JSON.stringify(finalAudit),
              },
            ],
          });
          if (res.length === 0 || res[0].errorCode !== 0) {
            loggerInstance.warn(
              `Kafka producer send response not successful. Details: ${
                res.length === 0
                  ? "Empty response"
                  : `Error code: ${res[0].errorCode}`
              }`
            );
            throw kafkaApplicationAuditingFailed();
          }
        } catch (e) {
          loggerInstance.warn(
            `Initializing fallback SQS for application auditing end middleware. Error: ${e}`
          );
          await fallbackApplicationAudit(
            queueManager,
            config,
            config.producerQueueUrl,
            finalAudit,
            loggerInstance
          );
        }
      });
    }

    return next();
  };
}

export async function applicationAuditEndSessionTokenExchangeMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig & JWTConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  const queueManager = initQueueManager({
    messageGroupId: "message_group_all_notification",
    logLevel: config.logLevel,
  });

  return async (req, res, next): Promise<void> => {
    if (req.path === "/session/tokens") {
      const defaultSend = res.send;

      // eslint-disable-next-line functional/no-let
      let sentBody: string | null = null;
      // eslint-disable-next-line functional/immutable-data
      res.send = function (body: string): ReturnType<typeof defaultSend> {
        sentBody = body;

        return defaultSend.call(this, body);
      };

      res.on("finish", async () => {
        const context = (req as Request & { ctx?: AppContext }).ctx;
        if (!context) {
          throw genericInternalError("Failed to retrieve context");
        }

        const loggerInstance = logger({
          serviceName: context?.serviceName,
          correlationId: context?.correlationId,
          spanId: context?.spanId,
        });

        loggerInstance.debug(
          `Application auditing end session token exchange middleware`
        );

        const correlationId = context.correlationId;
        const amznTraceId = parseAmznTraceIdHeader(req);
        const forwardedFor = parseForwardedForHeader(req);

        const ctxWithLogger = fromAppContext(context);

        const token = sentBody && JSON.parse(sentBody).session_token;

        // eslint-disable-next-line functional/no-let
        let authData: AuthData | null = null;

        if (token) {
          const decoded = decodeJwtToken(token, ctxWithLogger.logger);
          authData = decoded && readAuthDataFromJwtToken(decoded);
        }

        const { organizationId, selfcareId } =
          getUserInfoFromAuthData(authData);
        const endTimestamp = Date.now();

        const finalAudit: ApplicationAuditEndRequestSessionTokenExchange = {
          correlationId,
          spanId: context.spanId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.route?.path || req.path, // fallback because "req.route.path" is only available after entering the application router
          httpMethod: req.method,
          phase: ApplicationAuditPhase.END_REQUEST,
          requesterIpAddress: forwardedFor,
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: endTimestamp,
          amazonTraceId: amznTraceId,
          organizationId,
          selfcareId,
          httpResponseStatus: res.statusCode,
          executionTimeMs: endTimestamp - context.requestTimestamp,
        };

        try {
          const res = await producer.send({
            messages: [
              {
                key: correlationId,
                value: JSON.stringify(finalAudit),
              },
            ],
          });
          if (res.length === 0 || res[0].errorCode !== 0) {
            loggerInstance.warn(
              `Kafka producer send response not successful. Details: ${
                res.length === 0
                  ? "Empty response"
                  : `Error code: ${res[0].errorCode}`
              }`
            );
            throw kafkaApplicationAuditingFailed();
          }
        } catch (e) {
          loggerInstance.warn(
            `Initializing fallback SQS for application auditing end session token exchange middleware. Error: ${e}`
          );
          await fallbackApplicationAudit(
            queueManager,
            config,
            config.producerQueueUrl,
            finalAudit,
            loggerInstance
          );
        }
      });
    }

    return next();
  };
}

export async function applicationAuditAuthorizationServerEndMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  const queueManager = initQueueManager({
    messageGroupId: "message_group_all_notification",
    logLevel: config.logLevel,
  });

  return async (req, res, next): Promise<void> => {
    res.on("finish", async () => {
      const context = (req as Request & { ctx?: AuthServerAppContext }).ctx;
      if (!context) {
        throw genericInternalError("Failed to retrieve context");
      }

      const loggerInstance = logger({
        serviceName: context?.serviceName,
        correlationId: context?.correlationId,
        spanId: context?.spanId,
      });

      loggerInstance.debug(
        `Application auditing authorization server middleware`
      );

      const correlationId = context.correlationId;
      const amznTraceId = parseAmznTraceIdHeader(req);
      const forwardedFor = parseForwardedForHeader(req);

      const endTimestamp = Date.now();

      const finalAudit: ApplicationAuditEndRequestAuthServer = {
        correlationId,
        spanId: context.spanId,
        service: serviceName,
        serviceVersion: config.serviceVersion,
        endpoint: req.route?.path || req.path, // fallback because "req.route.path" is only available after entering the application router
        httpMethod: req.method,
        phase: ApplicationAuditPhase.END_REQUEST,
        requesterIpAddress: forwardedFor,
        nodeIp: config.nodeIp,
        podName: config.podName,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: endTimestamp,
        amazonTraceId: amznTraceId,
        organizationId: context.organizationId,
        clientId: context.clientId,
        clientKind: context.clientKind,
        httpResponseStatus: res.statusCode,
        executionTimeMs: endTimestamp - context.requestTimestamp,
      };

      try {
        const res = await producer.send({
          messages: [
            {
              key: correlationId,
              value: JSON.stringify(finalAudit),
            },
          ],
        });
        if (res.length === 0 || res[0].errorCode !== 0) {
          loggerInstance.warn(
            `Kafka producer send response not successful. Details: ${
              res.length === 0
                ? "Empty response"
                : `Error code: ${res[0].errorCode}`
            }`
          );
          throw kafkaApplicationAuditingFailed();
        }
      } catch (e) {
        loggerInstance.warn(
          `Initializing fallback SQS for application authorization server middleware. Error: ${e}`
        );
        await fallbackApplicationAudit(
          queueManager,
          config,
          config.producerQueueUrl,
          finalAudit,
          loggerInstance
        );
      }
    });

    return next();
  };
}

export const fallbackApplicationAudit = async (
  queueManager: QueueManager,
  config: ApplicationAuditProducerConfig,
  queueUrl: string,
  messageBody:
    | ApplicationAuditBeginRequest
    | ApplicationAuditEndRequest
    | ApplicationAuditEndRequestSessionTokenExchange
    | ApplicationAuditEndRequestAuthServer,
  logger: Logger
): Promise<void> => {
  try {
    await queueManager.send(
      queueUrl,
      {
        spanId: messageBody.spanId,
        correlationId: messageBody.correlationId,
        payload: messageBody,
      },
      logger
    );

    logger.info("Application audit sent to Kafka topic through fallback path");
  } catch {
    if (isFeatureFlagEnabled(config, "featureFlagApplicationAuditStrict")) {
      throw fallbackApplicationAuditingFailed();
    }
  }
};
