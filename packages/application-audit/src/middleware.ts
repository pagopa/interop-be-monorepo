import { RequestHandler, Request } from "express";
import { initProducer } from "kafka-iam-auth";
import { genericInternalError } from "pagopa-interop-models";
import {
  AppContext,
  ApplicationAuditProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export enum Phase {
  BEGIN_REQUEST = "BEGIN_REQUEST",
  END_REQUEST = "END_REQUEST",
}

export interface ApplicationAuditBeginRequest {
  correlationId: string;
  service: string;
  serviceVersion: string;
  endpoint: string;
  httpMethod: string;
  phase: Phase.BEGIN_REQUEST;
  requesterIpAddress: string;
  nodeIp: string;
  podName: string;
  uptimeSeconds: number;
  timestamp: number;
  amazonTraceId?: string;
}

export interface ApplicationAuditEndRequest {
  correlationId: string;
  service: string;
  serviceVersion: string;
  endpoint: string;
  httpMethod: string;
  phase: Phase.END_REQUEST;
  requesterIpAddress: string;
  nodeIp: string;
  podName: string;
  uptimeSeconds: number;
  timestamp: number;
  amazonTraceId?: string;
  organizationId: string;
  userId?: string;
  httpResponseStatus: number;
  executionTimeMs: number;
}

export interface ApplicationAuditEndRequestAuthServer {
  correlationId: string;
  service: string;
  serviceVersion: string;
  endpoint: string;
  httpMethod: string;
  phase: Phase.END_REQUEST;
  requesterIpAddress: string;
  nodeIp: string;
  podName: string;
  uptimeSeconds: number;
  timestamp: number;
  amazonTraceId?: string;
  organizationId?: string;
  clientId?: string;
  httpResponseStatus: number;
  executionTimeMs: number;
}

export interface ApplicationAuditEndRequestSessionTokenExchange {
  correlationId: string;
  service: string;
  serviceVersion: string;
  endpoint: string;
  httpMethod: string;
  phase: Phase.END_REQUEST;
  requesterIpAddress: string;
  nodeIp: string;
  podName: string;
  uptimeSeconds: number;
  timestamp: number;
  amazonTraceId?: string;
  organizationId?: string;
  selfcareId?: string;
  httpResponseStatus: number;
  executionTimeMs: number;
}

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

export async function applicationAuditMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);

  return async (req, res, next): Promise<void> => {
    if (
      !config.endpointsWithoutAudit ||
      (config.endpointsWithoutAudit &&
        !config.endpointsWithoutAudit.includes(req.path)) // TODO path contains the parameter, so how to match the string?
    ) {
      const context = (req as Request & { ctx?: AppContext }).ctx;
      const requestTimestamp = Date.now();

      const correlationId = context?.correlationId;
      const organizationId = context?.authData.organizationId;
      const amznTraceId = parseAmznTraceIdHeader(req);
      const forwardedFor = parseForwardedForHeader(req);
      if (!correlationId) {
        throw genericInternalError(
          "Failed to retrieve correlationId from context"
        );
      }

      if (!organizationId) {
        throw genericInternalError(
          "Failed to retrieve organizationId from context"
        );
      }

      if (!amznTraceId) {
        throw genericInternalError("The amznTraceId header is missing");
      }

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

      res.on("finish", async () => {
        const endTimestamp = Date.now();

        const finalAudit: ApplicationAuditEndRequest = {
          correlationId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.route.path,
          httpMethod: req.method,
          executionTimeMs: endTimestamp - requestTimestamp,
          organizationId,
          phase: Phase.END_REQUEST,
          httpResponseStatus: res.statusCode,
          requesterIpAddress: forwardedFor,
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: endTimestamp,
          amazonTraceId: amznTraceId,
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
