import { FastifyReply, FastifyRequest } from "fastify";
import { initProducer } from "kafka-iam-auth";
import {
  ApplicationAuditBeginRequest,
  ApplicationAuditEndRequest,
  ApplicationAuditPhase,
  genericInternalError,
  kafkaApplicationAuditingFailed,
} from "pagopa-interop-models";
import {
  ApplicationAuditProducerConfig,
  getUserInfoFromAuthData,
  initQueueManager,
  logger,
} from "pagopa-interop-commons";
import { z } from "zod";
import { fallbackApplicationAudit } from "./middlewares.js";

/**
 * Parses the AWS `X-Amzn-Trace-Id` header from the request.
 * This header is set by AWS Application Load Balancers and X-Ray
 * for distributed tracing across services.
 */
function parseFastifyAmznTraceIdHeader(
  request: FastifyRequest
): string | undefined {
  const parsed = z
    .object({ "x-amzn-trace-id": z.string() })
    .safeParse(request.headers);

  if (parsed.success) {
    return parsed.data["x-amzn-trace-id"];
  }
  return undefined;
}

function parseFastifyForwardedForHeader(
  request: FastifyRequest
): string | undefined {
  const parsed = z
    .object({ "x-forwarded-for": z.string() })
    .safeParse(request.headers);

  if (parsed.success) {
    return parsed.data["x-forwarded-for"];
  }
  return undefined;
}

export async function fastifyApplicationAuditBeginHook(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  const queueManager = initQueueManager({
    messageGroupId: "message_group_all_notification",
    logLevel: config.logLevel,
  });

  return async (request: FastifyRequest): Promise<void> => {
    const requestTimestamp = Date.now();

    const context = request.ctx;
    if (!context) {
      throw genericInternalError("Failed to retrieve context");
    }

    const loggerInstance = logger({
      serviceName: context.serviceName,
      correlationId: context.correlationId,
      spanId: context.spanId,
    });

    loggerInstance.debug(`Application auditing begin middleware`);

    // eslint-disable-next-line functional/immutable-data
    context.requestTimestamp = requestTimestamp;

    const correlationId = context.correlationId;
    const amznTraceId = parseFastifyAmznTraceIdHeader(request);
    const forwardedFor = parseFastifyForwardedForHeader(request);

    const initialAudit: ApplicationAuditBeginRequest = {
      correlationId,
      spanId: context.spanId,
      service: serviceName,
      serviceVersion: config.serviceVersion,
      endpoint: request.url,
      httpMethod: request.method,
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
  };
}

export async function fastifyApplicationAuditEndHook(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  const queueManager = initQueueManager({
    messageGroupId: "message_group_all_notification",
    logLevel: config.logLevel,
  });

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const context = request.ctx;
    if (!context) {
      throw genericInternalError("Failed to retrieve context");
    }

    const loggerInstance = logger({
      serviceName: context.serviceName,
      correlationId: context.correlationId,
      spanId: context.spanId,
    });

    loggerInstance.debug(`Application auditing end middleware`);

    const correlationId = context.correlationId;
    const amznTraceId = parseFastifyAmznTraceIdHeader(request);
    const forwardedFor = parseFastifyForwardedForHeader(request);

    const endTimestamp = Date.now();

    const { organizationId, userId } = getUserInfoFromAuthData(
      context.authData
    );

    const finalAudit: ApplicationAuditEndRequest = {
      correlationId,
      spanId: context.spanId,
      service: serviceName,
      serviceVersion: config.serviceVersion,
      endpoint: request.routeOptions?.url || request.url,
      httpMethod: request.method,
      phase: ApplicationAuditPhase.END_REQUEST,
      requesterIpAddress: forwardedFor,
      nodeIp: config.nodeIp,
      podName: config.podName,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: endTimestamp,
      amazonTraceId: amznTraceId,
      organizationId,
      userId,
      httpResponseStatus: reply.statusCode,
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
  };
}
