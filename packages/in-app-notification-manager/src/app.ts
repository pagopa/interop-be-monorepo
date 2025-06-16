// import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { zodiosCtx } from "pagopa-interop-commons";
import healthRouter from "./routers/healthRouter.js";
import { InAppNotificationService } from "./services/inAppNotificationService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(_: InAppNotificationService) {
  //   const serviceName = modelsServiceName.IN_APP_NOTIFICATION_MANAGER;

  //   const router = eserviceTemplatesRouter(zodiosCtx, service);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter);

  return app;
}
