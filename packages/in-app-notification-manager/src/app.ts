import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { config } from "./config/config.js";
import healthRouter from "./routers/healthRouter.js";
import { notificationRouter } from "./routers/notificationRouter.js";
import { InAppNotificationService } from "./services/inAppNotificationService.js";
import { notificationConfigFeatureFlagMiddleware } from "./utilities/middlewares.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: InAppNotificationService) {
  const serviceName = modelsServiceName.IN_APP_NOTIFICATION_MANAGER;
  const router = notificationRouter(zodiosCtx, service);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(notificationConfigFeatureFlagMiddleware());
  app.use(healthRouter);
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(router);

  return app;
}
