import {
  authenticationMiddleware,
  contextMiddleware,
  initDB,
  initFileManager,
  loggerMiddleware,
  ReadModelRepository,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import {
  makeDrizzleConnection,
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import eservicesRouter from "./routers/EServiceRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";
import {
  CatalogService,
  catalogServiceBuilder,
} from "./services/catalogService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultCatalogService = async () => {
  const db = makeDrizzleConnection(config);
  const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
  const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
  const eserviceTemplateReadModelServiceSQL =
    eserviceTemplateReadModelServiceBuilder(db);

  const readModelRepository = ReadModelRepository.init(config);

  const oldReadModelService = readModelServiceBuilder(readModelRepository);
  const readModelServiceSQL = readModelServiceBuilderSQL(
    db,
    catalogReadModelServiceSQL,
    tenantReadModelServiceSQL,
    eserviceTemplateReadModelServiceSQL
  );

  const readModelService =
    config.featureFlagSQL &&
    config.readModelSQLDbHost &&
    config.readModelSQLDbPort
      ? readModelServiceSQL
      : oldReadModelService;

  return catalogServiceBuilder(
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
    initFileManager(config)
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: CatalogService) {
  const serviceName = modelsServiceName.CATALOG_PROCESS;

  const router =
    service != null
      ? eservicesRouter(zodiosCtx, service)
      : eservicesRouter(zodiosCtx, await createDefaultCatalogService());

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
