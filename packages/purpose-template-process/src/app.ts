import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { PurposeTemplateService } from "./services/purposeTemplateService.js";
import purposeTemplateRouter from "./routers/PurposeTemplateRouter.js";
import { config } from "./config/config.js";
import { purposeTemplateFeatureFlagMiddleware } from "./utilities/middleware.js";
import { purposeTemplateApi } from "pagopa-interop-api-clients";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: PurposeTemplateService) {
  const serviceName = modelsServiceName.PURPOSE_TEMPLATE_PROCESS;
  const router = purposeTemplateRouter(zodiosCtx, service);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");
  app.use(healthRouter(purposeTemplateApi.healthApi.api));
  app.use(purposeTemplateFeatureFlagMiddleware());
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(router);
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
