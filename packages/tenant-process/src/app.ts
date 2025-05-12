import {
  ReadModelRepository,
  authenticationMiddleware,
  contextMiddleware,
  initDB,
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
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import healthRouter from "./routers/HealthRouter.js";
import tenantRouter from "./routers/TenantRouter.js";
import { config } from "./config/config.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "./services/tenantService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
//
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultTenantService = async () => {
  const db = makeDrizzleConnection(config);
  const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
  const agreementReadModelServiceSQL = agreementReadModelServiceBuilder(db);
  const attributeReadModelServiceSQL = attributeReadModelServiceBuilder(db);
  const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
  const delegationReadModelServiceSQL = delegationReadModelServiceBuilder(db);

  const readModelRepository = ReadModelRepository.init(config);

  const oldReadModelService = readModelServiceBuilder(readModelRepository);
  const readModelServiceSQL = readModelServiceBuilderSQL(
    db,
    tenantReadModelServiceSQL,
    agreementReadModelServiceSQL,
    attributeReadModelServiceSQL,
    catalogReadModelServiceSQL,
    delegationReadModelServiceSQL
  );

  const readModelService =
    config.featureFlagSQL &&
    config.readModelSQLDbHost &&
    config.readModelSQLDbPort
      ? readModelServiceSQL
      : oldReadModelService;

  return tenantServiceBuilder(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    readModelService
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: TenantService) {
  const serviceName = modelsServiceName.TENANT_PROCESS;

  const router =
    service != null
      ? tenantRouter(zodiosCtx, service)
      : tenantRouter(zodiosCtx, await createDefaultTenantService());

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
