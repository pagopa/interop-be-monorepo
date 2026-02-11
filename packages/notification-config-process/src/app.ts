import express from "express";
import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouterSimple,
  loggerMiddleware,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import notificationConfigRouter from "./routers/NotificationConfigRouter.js";
import { config } from "./config/config.js";
import { NotificationConfigService } from "./services/notificationConfigService.js";
import { notificationConfigFeatureFlagMiddleware } from "./utilities/middlewares.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: NotificationConfigService) {
  const serviceName = modelsServiceName.NOTIFICATION_CONFIG_PROCESS;

  const router = notificationConfigRouter(service);

  const app = express();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouterSimple());
  app.use(notificationConfigFeatureFlagMiddleware());
  app.use(express.json());
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(router);
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
