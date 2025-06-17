// import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { zodiosCtx } from "pagopa-interop-commons";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { contextMiddleware } from "pagopa-interop-commons";
import { applicationAuditBeginMiddleware } from "pagopa-interop-application-audit";
import { applicationAuditEndMiddleware } from "pagopa-interop-application-audit";
import { authenticationMiddleware } from "pagopa-interop-commons";
import { loggerMiddleware } from "pagopa-interop-commons";
import { notificationRouter } from "./routers/NotificationRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { InAppNotificationService } from "./services/inAppNotificationService.js";
import { config } from "./config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: InAppNotificationService) {
  const serviceName = modelsServiceName.IN_APP_NOTIFICATION_MANAGER;
  const router = notificationRouter(zodiosCtx, service);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter);
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(router);

  return app;
}
