/* eslint-disable no-console */
import {
  AppContext,
  ApplicationAuditTopicConfig,
  authenticationMiddleware,
  contextMiddleware,
  KafkaProducerConfig,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { RequestHandler, Request } from "express";
import { initProducer } from "kafka-iam-auth";
import { genericInternalError } from "pagopa-interop-models";
import eservicesRouter from "./routers/EServiceRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";

enum Phase {
  BEGIN_REQUEST = "BEGIN_REQUEST",
  END_REQUEST = "END_REQUEST",
}

interface ApplicationAuditBeginRequest {
  correlationId: string;
  service: string;
  serviceVersion: string;
  endpoint: string;
  httpMethod: string; // TODO different from given template
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
  httpMethod: string; // TODO different from given template
  executionTimeMs: number;
  organizationId: string;
  userId?: string;
  phase: Phase.END_REQUEST;
  httpResponseStatus: number; // TODO different from given template
  requesterIpAddress: string;
  nodeIp: string;
  podName: string;
  uptimeSeconds: number;
  timestamp: number;
  amazonTraceId: string;
}

export async function applicationAuditMiddleware(
  serviceName: string,
  config: KafkaProducerConfig & ApplicationAuditTopicConfig
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
      serviceVersion: "TODO: READ FROM ENV",
      endpoint: req.path,
      httpMethod: req.method,
      phase: Phase.BEGIN_REQUEST,
      requesterIpAddress: "TODO",
      nodeIp: "TODO: READ FROM ENV",
      podName: "TODO: READ FROM ENV",
      uptimeSeconds: process.uptime(), // TODO how many decimal digits?
      timestamp: requestTimestamp,
      amazonTraceId: "TODO",
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
        serviceVersion: "TODO: READ FROM ENV",
        endpoint: req.path,
        httpMethod: req.method,
        executionTimeMs: endTimestamp - requestTimestamp,
        organizationId,
        phase: Phase.END_REQUEST,
        httpResponseStatus: res.statusCode,
        requesterIpAddress: "TODO",
        nodeIp: "TODO: READ FROM ENV",
        podName: "TODO: READ FROM ENV",
        uptimeSeconds: process.uptime(),
        timestamp: endTimestamp,
        amazonTraceId: "TODO",
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

const serviceName = "catalog-process";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName));
app.use(authenticationMiddleware(config));
app.use(loggerMiddleware(serviceName));
app.use(await applicationAuditMiddleware(serviceName, config));
app.use(eservicesRouter(zodiosCtx));

export default app;
