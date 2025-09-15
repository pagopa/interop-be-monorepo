import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import healthRouter from "./routers/HealthRouter.js";
import tenantRouter from "./routers/TenantRouter.js";
import { config } from "./config/config.js";
import { TenantService } from "./services/tenantService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: TenantService) {
  const serviceName = modelsServiceName.TENANT_PROCESS;

  const router = tenantRouter(zodiosCtx, service);

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
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
