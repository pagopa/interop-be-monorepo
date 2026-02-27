import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  loggerMiddleware,
  sanitizeMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import eserviceTemplatesRouter from "./routers/EServiceTemplateRouter.js";
import { config } from "./config/config.js";
import { EServiceTemplateService } from "./services/eserviceTemplateService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: EServiceTemplateService) {
  const serviceName = modelsServiceName.ESERVICE_TEMPLATE_PROCESS;

  const router = eserviceTemplatesRouter(zodiosCtx, service);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter(eserviceTemplateApi.healthApi.api));
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(sanitizeMiddleware());
  app.use(router);
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
