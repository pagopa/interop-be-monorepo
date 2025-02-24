/* eslint-disable no-console */
import { RequestHandler, Request } from "express";
import { initProducer } from "kafka-iam-auth";
import { genericInternalError } from "pagopa-interop-models";
import {
  AppContext,
  ApplicationAuditProducerConfig,
} from "pagopa-interop-commons";

enum Phase {
  BEGIN_REQUEST = "BEGIN_REQUEST",
  END_REQUEST = "END_REQUEST",
}

interface ApplicationAuditBeginRequest {
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
  amazonTraceId: string;
}

interface ApplicationAuditEndRequest {
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
  amazonTraceId: string;
  organizationId: string;
  userId?: string;
  httpResponseStatus: number;

  executionTimeMs: number;
}

export async function applicationAuditMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  console.log("INIT PRODUCER");
  const producer = await initProducer(config, config.applicationAuditTopic);

  return async (req, res, next): Promise<void> => {
    const context = (req as Request & { ctx?: AppContext }).ctx;
    const requestTimestamp = Date.now();

    const correlationId = context?.correlationId;
    const organizationId = context?.authData.organizationId;
    if (!correlationId) {
      throw genericInternalError("TODO");
    }

    if (!organizationId) {
      throw genericInternalError("TODO");
    }

    const firstMessage: ApplicationAuditBeginRequest = {
      correlationId,
      service: serviceName,
      serviceVersion: config.stringProp,
      endpoint: req.path,
      httpMethod: req.method,
      phase: Phase.BEGIN_REQUEST,
      requesterIpAddress: "TODO",
      nodeIp: config.stringProp,
      podName: config.stringProp,
      uptimeSeconds: process.uptime(), // TODO how many decimal digits?
      timestamp: requestTimestamp,
      amazonTraceId: config.stringProp,
    };

    await producer.send({
      messages: [
        {
          key: "TODO",
          value: JSON.stringify(firstMessage),
        },
      ],
    });
    console.log("APPLICATION AUDIT - REQUEST RECEIVED", firstMessage);

    res.on("finish", async () => {
      const endTimestamp = Date.now();

      const secondMessage: ApplicationAuditEndRequest = {
        correlationId,
        service: serviceName,
        serviceVersion: config.stringProp,
        endpoint: req.path,
        httpMethod: req.method,
        executionTimeMs: endTimestamp - requestTimestamp,
        organizationId,
        phase: Phase.END_REQUEST,
        httpResponseStatus: res.statusCode,
        requesterIpAddress: "TODO",
        nodeIp: config.stringProp,
        podName: config.stringProp,
        uptimeSeconds: process.uptime(),
        timestamp: endTimestamp,
        amazonTraceId: config.stringProp,
      };
      await producer.send({
        messages: [
          {
            key: "TODO",
            value: JSON.stringify(secondMessage),
          },
        ],
      });
      console.log("APPLICATION AUDIT - REQUEST HANDLED", secondMessage);
    });
    return next();
  };
}
