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
import { riskAnalysisApi } from "pagopa-interop-api-clients";
import riskAnalysisRouter from "./routers/RiskAnalysisRouter.js";
import { config } from "./config/config.js";
import { RiskAnalysisService } from "./services/riskAnalysisService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: RiskAnalysisService) {
  const serviceName = modelsServiceName.RISK_ANALYSIS_PROCESS;

  const router =
    service != null
      ? riskAnalysisRouter(zodiosCtx, service)
      : riskAnalysisRouter(zodiosCtx);

  const app = zodiosCtx.app();

  app.disable("x-powered-by");

  app.use(healthRouter(riskAnalysisApi.healthApi.api));
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
