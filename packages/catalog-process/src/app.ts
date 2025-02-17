/* eslint-disable no-console */
import {
  AppContext,
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { RequestHandler, Request } from "express";

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

export function applicationAuditMiddleware(
  serviceName: string
): RequestHandler {
  return (req, res, next): void => {
    const context = (req as Request & { ctx?: AppContext }).ctx;
    const requestTimestamp = Date.now();

    const correlationId = context?.correlationId;

    if (!correlationId) {
      throw genericInternalError("TODO");
    }

    const firstMessage: ApplicationAuditBeginRequest = {
      correlationId,
      service: serviceName,
      serviceVersion: "TODO: READ FROM ENV",
      endpoint: req.path,
      httpMethod: req.method,
      phase: Phase.BEGIN_REQUEST,
      requesterIpAddress: "",
      nodeIp: "TODO: READ FROM ENV",
      podName: "TODO: READ FROM ENV",
      uptimeSeconds: process.uptime(), // TODO how many decimal digits?
      timestamp: Date.now(),
      amazonTraceId: "TODO",
    };
    console.log("APPLICATION AUDIT - REQUEST RECEIVED", firstMessage);

    res.on("finish", () => {
      const endTimestamp = Date.now();

      // const secondMessage: ApplicationAuditEndRequest = {
      //   correlationId: "",
      //   service: "",
      //   serviceVersion: "",
      //   endpoint: "",
      //   httpMethod: "",
      //   executionTimeMs: 0,
      //   organizationId: "",
      //   phase: Phase.END_REQUEST,
      //   httpResponseStatus: 0,
      //   requesterIpAddress: "",
      //   nodeIp: "",
      //   podName: "",
      //   uptimeSeconds: 0,
      //   timestamp: 0,
      //   amazonTraceId: "",
      // };
      console.log(
        "APPLICATION AUDIT - REQUEST HANDLED",
        endTimestamp - requestTimestamp
      );
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
app.use(applicationAuditMiddleware(serviceName));
app.use(eservicesRouter(zodiosCtx));

export default app;
