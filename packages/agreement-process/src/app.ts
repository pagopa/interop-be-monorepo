import {
  ReadModelRepository,
  authenticationMiddleware,
  contextMiddleware,
  initDB,
  initFileManager,
  initPDFGenerator,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import healthRouter from "./routers/HealthRouter.js";
import agreementRouter from "./routers/AgreementRouter.js";
import { config } from "./config/config.js";
import {
  AgreementService,
  agreementServiceBuilder,
} from "./services/agreementService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultAgreementService = async () => {
  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  const pdfGenerator = await initPDFGenerator();

  return agreementServiceBuilder(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    readModelService,
    initFileManager(config),
    pdfGenerator
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: AgreementService) {
  const serviceName = modelsServiceName.AGREEMENT_PROCESS;

  const router =
    service != null
      ? agreementRouter(zodiosCtx, service)
      : agreementRouter(zodiosCtx, await createDefaultAgreementService());

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

  return app;
}
