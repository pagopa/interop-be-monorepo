import { WithZodiosContext } from "@zodios/express";
import express, { NextFunction, Response } from "express";
import { ExpressContext, fromAppContext, logger } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

type PrivacySafeRequestLog = {
  method: string;
  route: string;
  status: number;
  correlationId: CorrelationId;
  durationMs: number;
};

export type PrivacySafeRequestLogSink = (entry: PrivacySafeRequestLog) => void;

const makeDefaultSink =
  (serviceName: string): PrivacySafeRequestLogSink =>
  (entry) => {
    logger({
      serviceName,
      correlationId: entry.correlationId,
    }).info(entry);
  };

export const privacySafeLoggerMiddleware =
  (
    serviceName: string,
    route: string,
    sink: PrivacySafeRequestLogSink = makeDefaultSink(serviceName)
  ): express.RequestHandler =>
  (
    req: WithZodiosContext<express.Request, ExpressContext>,
    res: Response,
    next: NextFunction
  ): void => {
    const start = performance.now();

    res.on("finish", () => {
      const ctx = fromAppContext(req.ctx);
      sink({
        method: req.method,
        route,
        status: res.statusCode,
        correlationId: ctx.correlationId,
        durationMs: performance.now() - start,
      });
    });

    next();
  };
