import {
  authenticationMiddleware,
  contextMiddleware,
  zodiosCtx,
  sanitizeMiddleware,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import healthRouter from "./routers/HealthRouter.js";
import authorizationRouter from "./routers/AuthorizationRouter.js";
import { config } from "./config/config.js";
import { AuthorizationService } from "./services/authorizationService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: AuthorizationService) {
  const serviceName = modelsServiceName.AUTHORIZATION_PROCESS;

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter);
  app.use(contextMiddleware(serviceName));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(await applicationAuditEndMiddleware(serviceName, config));
  app.use(authenticationMiddleware(config));
  app.use(sanitizeMiddleware());
  app.use(authorizationRouter(zodiosCtx, service));

  return app;
}
