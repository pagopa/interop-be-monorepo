import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  loggerMiddleware,
  zodiosCtx,
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
import { notificationConfigApi } from "pagopa-interop-api-clients";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: NotificationConfigService) {
  const serviceName = modelsServiceName.NOTIFICATION_CONFIG_PROCESS;

  const router = notificationConfigRouter(zodiosCtx, service);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter(notificationConfigApi.healthApi.api));
  app.use(notificationConfigFeatureFlagMiddleware());
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(router);
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
