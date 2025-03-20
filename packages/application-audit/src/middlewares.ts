import { RequestHandler, Request } from "express";
import { initProducer } from "kafka-iam-auth";
import { genericInternalError } from "pagopa-interop-models";
import {
  AppContext,
  ApplicationAuditProducerConfig,
  fromAppContext,
  JWTConfig,
  readAuthDataFromJwtToken,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { z } from "zod";

const Phase = {
  BEGIN_REQUEST: "BEGIN_REQUEST",
  END_REQUEST: "END_REQUEST",
} as const;

const ApplicationAuditBeginRequest = z.object({
  correlationId: z.string(),
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(Phase.BEGIN_REQUEST),
  requesterIpAddress: z.string(),
  nodeIp: z.string(),
  podName: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.number(),
  amazonTraceId: z.string().optional(),
});
type ApplicationAuditBeginRequest = z.infer<
  typeof ApplicationAuditBeginRequest
>;

const ApplicationAuditEndRequest = z.object({
  correlationId: z.string(),
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(Phase.END_REQUEST),
  requesterIpAddress: z.string(),
  nodeIp: z.string(),
  podName: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.number(),
  amazonTraceId: z.string().optional(),
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  httpResponseStatus: z.number(),
  executionTimeMs: z.number(),
});
type ApplicationAuditEndRequest = z.infer<typeof ApplicationAuditEndRequest>;

// const ApplicationAuditEndRequestAuthServer = z.object({
//   correlationId: z.string(),
//   service: z.string(),
//   serviceVersion: z.string(),
//   endpoint: z.string(),
//   httpMethod: z.string(),
//   phase: z.literal(phase.END_REQUEST),
//   requesterIpAddress: z.string(),
//   nodeIp: z.string(),
//   podName: z.string(),
//   uptimeSeconds: z.number(),
//   timestamp: z.number(),
//   amazonTraceId: z.string().optional(),
//   organizationId: z.string().optional(),
//   clientId: z.string().optional(),
//   httpResponseStatus: z.number(),
//   executionTimeMs: z.number(),
// });
// type ApplicationAuditEndRequestAuthServer = z.infer<
//   typeof ApplicationAuditEndRequestAuthServer
// >;

export const ApplicationAuditEndRequestSessionTokenExchange = z.object({
  correlationId: z.string(),
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(Phase.END_REQUEST),
  requesterIpAddress: z.string(),
  nodeIp: z.string(),
  podName: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.number(),
  amazonTraceId: z.string().optional(),
  organizationId: z.string().optional(),
  selfcareId: z.string().optional(),
  httpResponseStatus: z.number(),
  executionTimeMs: z.number(),
});
export type ApplicationAuditEndRequestSessionTokenExchange = z.infer<
  typeof ApplicationAuditEndRequestSessionTokenExchange
>;

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

  return async (req, _, next): Promise<void> => {
    const context = (req as Request & { ctx?: AppContext }).ctx;
    const requestTimestamp = Date.now();

    if (!context) {
      throw genericInternalError("Failed to retrieve context");
    }

    // eslint-disable-next-line functional/immutable-data
    context.requestTimestamp = requestTimestamp;

    const correlationId = context.correlationId;
    const amznTraceId = parseAmznTraceIdHeader(req);
    const forwardedFor = parseForwardedForHeader(req);

    if (!forwardedFor) {
      throw genericInternalError("The forwardedFor header is missing");
    }

    const initialAudit: ApplicationAuditBeginRequest = {
      correlationId,
      service: serviceName,
      serviceVersion: config.serviceVersion,
      endpoint: req.path,
      httpMethod: req.method,
      phase: Phase.BEGIN_REQUEST,
      requesterIpAddress: forwardedFor,
      nodeIp: config.nodeIp,
      podName: config.podName,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: requestTimestamp,
      amazonTraceId: amznTraceId,
    };

    await producer.send({
      messages: [
        {
          key: correlationId,
          value: JSON.stringify(initialAudit),
        },
      ],
    });

    return next();
  };
}

export async function applicationAuditEndMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);
  return async (req, res, next): Promise<void> => {
    if (
      !config.endpointsWithCustomAudit ||
      (config.endpointsWithCustomAudit &&
        !config.endpointsWithCustomAudit.includes(req.path))
    ) {
      res.on("finish", async () => {
        const context = (req as Request & { ctx?: AppContext }).ctx;
        if (!context) {
          throw genericInternalError("Failed to retrieve context");
        }

        const correlationId = context.correlationId;
        const amznTraceId = parseAmznTraceIdHeader(req);
        const forwardedFor = parseForwardedForHeader(req);

        if (!forwardedFor) {
          throw genericInternalError("The forwardedFor header is missing");
        }

        const endTimestamp = Date.now();

        const finalAudit: ApplicationAuditEndRequest = {
          correlationId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.route?.path || req.path, // fallback because "req.route.path" is only available after entering the application router
          httpMethod: req.method,
          phase: Phase.END_REQUEST,
          requesterIpAddress: forwardedFor,
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: endTimestamp,
          amazonTraceId: amznTraceId,
          organizationId: context.authData?.organizationId,
          userId: context.authData?.userId,
          httpResponseStatus: res.statusCode,
          executionTimeMs: endTimestamp - context.requestTimestamp,
        };

        await producer.send({
          messages: [
            {
              key: correlationId,
              value: JSON.stringify(finalAudit),
            },
          ],
        });
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
  return async (req, res, next): Promise<void> => {
    if (config.endpointsWithCustomAudit?.includes(req.path)) {
      res.on("finish", async () => {
        const context = (req as Request & { ctx?: AppContext }).ctx;
        if (!context) {
          throw genericInternalError("Failed to retrieve context");
        }

        const correlationId = context.correlationId;
        const amznTraceId = parseAmznTraceIdHeader(req);
        const forwardedFor = parseForwardedForHeader(req);

        const ctxWithLogger = fromAppContext(context);

        /*

        body = {
          "session_token": "token"
        }

        */

        const token: string | undefined = "todo";

        const authData = token
          ? readAuthDataFromJwtToken(
              await verifyJwtToken(token, config, ctxWithLogger.logger)
            )
          : undefined;

        if (!forwardedFor) {
          throw genericInternalError("The forwardedFor header is missing");
        }

        const endTimestamp = Date.now();

        const finalAudit: ApplicationAuditEndRequestSessionTokenExchange = {
          correlationId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.route?.path || req.path, // fallback because "req.route.path" is only available after entering the application router
          httpMethod: req.method,
          phase: Phase.END_REQUEST,
          requesterIpAddress: forwardedFor,
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: endTimestamp,
          amazonTraceId: amznTraceId,
          organizationId: authData?.organizationId,
          selfcareId: authData?.selfcareId,
          httpResponseStatus: res.statusCode,
          executionTimeMs: endTimestamp - context.requestTimestamp,
        };

        await producer.send({
          messages: [
            {
              key: correlationId,
              value: JSON.stringify(finalAudit),
            },
          ],
        });
      });
    }

    return next();
  };
}
