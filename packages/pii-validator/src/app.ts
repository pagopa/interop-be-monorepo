import express, { RequestHandler } from "express";
import { piiValidatorApi } from "pagopa-interop-api-clients";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  zodiosCtx,
} from "pagopa-interop-commons";
import { serviceName as modelsServiceName } from "pagopa-interop-models";

import { config } from "./config/config.js";
import { privacySafeJsonErrorMiddleware } from "./middleware/privacySafeJsonErrorMiddleware.js";
import {
  PrivacySafeRequestLogSink,
  privacySafeLoggerMiddleware,
} from "./middleware/privacySafeLoggerMiddleware.js";
import detectionRouter from "./routers/detectionRouter.js";
import { DetectionService } from "./services/detectionService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(
  service?: DetectionService,
  options: {
    requestLogSink?: PrivacySafeRequestLogSink;
    auditBeginMiddleware?: RequestHandler;
    auditEndMiddleware?: RequestHandler;
  } = {}
) {
  const serviceName = modelsServiceName.PII_VALIDATOR;
  const router = detectionRouter(zodiosCtx, service);
  const app = zodiosCtx.app(undefined, {
    enableJsonBodyParser: false,
  }) as unknown as express.Express;

  app.disable("x-powered-by");
  app.use(healthRouter(piiValidatorApi.healthApi.api));
  app.use(contextMiddleware(serviceName));
  app.use(
    options.auditBeginMiddleware ??
      (await applicationAuditBeginMiddleware(serviceName, config))
  );
  app.use(
    options.auditEndMiddleware ??
      (await applicationAuditEndMiddleware(serviceName, config))
  );
  app.use("/detect", (req, res, next) => {
    res.type("application/problem+json");
    // The shared authentication middleware logs req.url for malformed tokens.
    // This endpoint has no query-string contract, so remove it before auth.
    // eslint-disable-next-line functional/immutable-data
    req.url = req.path;
    next();
  });
  app.use(authenticationMiddleware(config));
  app.use(
    privacySafeLoggerMiddleware(serviceName, "/detect", options.requestLogSink)
  );
  app.use(express.json());
  app.use(router);
  app.use(privacySafeJsonErrorMiddleware);
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
