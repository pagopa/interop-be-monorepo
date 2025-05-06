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
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import purposeRouter from "./routers/PurposeRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "./services/purposeService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultPurposeService = async () => {
  const readModelDB = makeDrizzleConnection(config);
  const purposeReadModelServiceSQL =
    purposeReadModelServiceBuilder(readModelDB);
  const catalogReadModelServiceSQL =
    catalogReadModelServiceBuilder(readModelDB);
  const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
  const agreementReadModelServiceSQL =
    agreementReadModelServiceBuilder(readModelDB);
  const delegationReadModelServiceSQL =
    delegationReadModelServiceBuilder(readModelDB);

  const oldReadModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  const readModelServiceSQL = readModelServiceBuilderSQL({
    readModelDB,
    purposeReadModelServiceSQL,
    catalogReadModelServiceSQL,
    tenantReadModelServiceSQL,
    agreementReadModelServiceSQL,
    delegationReadModelServiceSQL,
  });
  const readModelService =
    config.featureFlagSQL &&
    config.readModelSQLDbHost &&
    config.readModelSQLDbPort
      ? readModelServiceSQL
      : oldReadModelService;

  const fileManager = initFileManager(config);
  const pdfGenerator = await initPDFGenerator();

  return purposeServiceBuilder(
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
    fileManager,
    pdfGenerator
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: PurposeService) {
  const serviceName = modelsServiceName.PURPOSE_PROCESS;

  const router =
    service != null
      ? purposeRouter(zodiosCtx, service)
      : purposeRouter(zodiosCtx, await createDefaultPurposeService());

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
