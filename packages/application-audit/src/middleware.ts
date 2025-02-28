import { RequestHandler, Request } from "express";
import { initProducer } from "kafka-iam-auth";
import { genericInternalError } from "pagopa-interop-models";
import {
  AppContext,
  ApplicationAuditProducerConfig,
} from "pagopa-interop-commons";

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

export interface ApplicationAuditEndRequestCustomAuthServer {
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
  clientId?: string;
  httpResponseStatus: number;
  executionTimeMs: number;
}

export interface ApplicationAuditEndRequestCustomBFF {
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

export async function applicationAuditMiddleware(
  serviceName: string,
  config: ApplicationAuditProducerConfig
): Promise<RequestHandler> {
  const producer = await initProducer(config, config.applicationAuditTopic);

  return async (req, res, next): Promise<void> => {
    console.log("path: ", req.path);
    console.log("url: ", req.url);
    if (req.path !== "/session/tokens") {
      const context = (req as Request & { ctx?: AppContext }).ctx;
      const requestTimestamp = Date.now();

      const correlationId = context?.correlationId;
      const organizationId = context?.authData.organizationId;
      if (!correlationId) {
        throw genericInternalError("TODO: error or non-null assertion?");
      }

      if (!organizationId) {
        throw genericInternalError("TODO: error or non-null assertion?");
      }

      const initialAudit: ApplicationAuditBeginRequest = {
        correlationId,
        service: serviceName,
        serviceVersion: config.serviceVersion,
        /*
          req.path:  /eservices/
          req.url:  /eservices/?offset=0&limit=1
         */
        endpoint: req.path, // TODO req.path or req.url?
        httpMethod: req.method,
        phase: Phase.BEGIN_REQUEST,
        requesterIpAddress: "TODO",
        nodeIp: config.nodeIp,
        podName: config.podName,
        uptimeSeconds: process.uptime(), // TODO how many decimal digits?
        timestamp: requestTimestamp,
        amazonTraceId: config.amazonTraceId,
      };

      await producer.send({
        messages: [
          {
            key: "TODO",
            value: JSON.stringify(initialAudit),
          },
        ],
      });
      console.log("APPLICATION AUDIT - REQUEST RECEIVED", initialAudit);

      res.on("finish", async () => {
        const endTimestamp = Date.now();

        const finalAudit: ApplicationAuditEndRequest = {
          correlationId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.path,
          httpMethod: req.method,
          executionTimeMs: endTimestamp - requestTimestamp,
          organizationId,
          phase: Phase.END_REQUEST,
          httpResponseStatus: res.statusCode,
          requesterIpAddress: "TODO",
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: process.uptime(),
          timestamp: endTimestamp,
          amazonTraceId: config.amazonTraceId,
        };
        await producer.send({
          messages: [
            {
              key: "TODO",
              value: JSON.stringify(finalAudit),
            },
          ],
        });
        console.log("APPLICATION AUDIT - REQUEST HANDLED", finalAudit);
      });
    }

    return next();
  };
}
