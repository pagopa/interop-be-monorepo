import { z } from "zod";
import { CorrelationId, SpanId } from "../brandedIds.js";
import { ClientKindTokenGenStates } from "../token-generation-readmodel/commons.js";

export const ApplicationAuditPhase = {
  BEGIN_REQUEST: "BEGIN_REQUEST",
  END_REQUEST: "END_REQUEST",
} as const;

export const ApplicationAuditBeginRequest = z.object({
  correlationId: CorrelationId,
  spanId: SpanId,
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(ApplicationAuditPhase.BEGIN_REQUEST),
  requesterIpAddress: z.string().optional(),
  nodeIp: z.string(),
  podName: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.number(),
  amazonTraceId: z.string().optional(),
});
export type ApplicationAuditBeginRequest = z.infer<
  typeof ApplicationAuditBeginRequest
>;

export const ApplicationAuditEndRequest = z.object({
  correlationId: CorrelationId,
  spanId: SpanId,
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(ApplicationAuditPhase.END_REQUEST),
  requesterIpAddress: z.string().optional(),
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
export type ApplicationAuditEndRequest = z.infer<
  typeof ApplicationAuditEndRequest
>;

export const ApplicationAuditEndRequestAuthServer = z.object({
  correlationId: CorrelationId,
  spanId: SpanId,
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(ApplicationAuditPhase.END_REQUEST),
  requesterIpAddress: z.string().optional(),
  nodeIp: z.string(),
  podName: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.number(),
  amazonTraceId: z.string().optional(),
  organizationId: z.string().optional(),
  clientId: z.string().optional(),
  clientKind: ClientKindTokenGenStates.optional(),
  httpResponseStatus: z.number(),
  executionTimeMs: z.number(),
});
export type ApplicationAuditEndRequestAuthServer = z.infer<
  typeof ApplicationAuditEndRequestAuthServer
>;

export const ApplicationAuditEndRequestSessionTokenExchange = z.object({
  correlationId: CorrelationId,
  spanId: SpanId,
  service: z.string(),
  serviceVersion: z.string(),
  endpoint: z.string(),
  httpMethod: z.string(),
  phase: z.literal(ApplicationAuditPhase.END_REQUEST),
  requesterIpAddress: z.string().optional(),
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
