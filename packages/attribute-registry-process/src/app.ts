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
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import attributeRouter from "./routers/AttributeRouter.js";
import { config } from "./config/config.js";
import { AttributeRegistryService } from "./services/attributeRegistryService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: AttributeRegistryService) {
  const serviceName = modelsServiceName.ATTRIBUTE_REGISTRY_PROCESS;

  const router =
    service != null
      ? attributeRouter(zodiosCtx, service)
      : attributeRouter(zodiosCtx);

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter(attributeRegistryApi.healthApi.api));
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(serviceName));
  app.use(router);
  app.use(errorsToApiProblemsMiddleware);

  return app;
}

const app = await createApp();

export default app;
