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
import agreementRouter from "./routers/AgreementRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { AgreementService } from "./services/agreementService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: AgreementService) {
  const serviceName = modelsServiceName.AGREEMENT_PROCESS;

  const router = agreementRouter(zodiosCtx, service);

  const app = zodiosCtx.app();
  // CI trigger for testing purposes

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
