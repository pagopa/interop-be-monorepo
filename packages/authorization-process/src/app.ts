import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import authorizationRouter from "./routers/AuthorizationRouter.js";
import { config } from "./config/config.js";
import { AuthorizationService } from "./services/authorizationService.js";
import { authorizationApi } from "pagopa-interop-api-clients";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: AuthorizationService) {
  const serviceName = modelsServiceName.AUTHORIZATION_PROCESS;

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter(authorizationApi.healthApi.api));
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(authorizationRouter(zodiosCtx, service));
  app.use(errorsToApiProblemsMiddleware);

  return app;
}
