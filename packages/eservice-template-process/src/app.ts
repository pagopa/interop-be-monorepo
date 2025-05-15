import {
  ReadModelRepository,
  authenticationMiddleware,
  contextMiddleware,
  initDB,
  initFileManager,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import eserviceTemplatesRouter from "./routers/EServiceTemplateRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";
import {
  EServiceTemplateService,
  eserviceTemplateServiceBuilder,
} from "./services/eserviceTemplateService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultEserviceTemplateService = async () => {
  const readModelDB = makeDrizzleConnection(config);
  const eserviceTemplateReadModelServiceSQL =
    eserviceTemplateReadModelServiceBuilder(readModelDB);
  const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
  const attributeReadModelServiceSQL =
    attributeReadModelServiceBuilder(readModelDB);

  const oldReadModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  const readModelServiceSQL = readModelServiceBuilderSQL({
    readModelDB,
    eserviceTemplateReadModelServiceSQL,
    tenantReadModelServiceSQL,
    attributeReadModelServiceSQL,
  });
  const readModelService =
    config.featureFlagSQL &&
    config.readModelSQLDbHost &&
    config.readModelSQLDbPort
      ? readModelServiceSQL
      : oldReadModelService;

  return eserviceTemplateServiceBuilder(
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
export async function createApp(service?: EServiceTemplateService) {
  const serviceName = modelsServiceName.ESERVICE_TEMPLATE_PROCESS;

  const router =
    service != null
      ? eserviceTemplatesRouter(zodiosCtx, service)
      : eserviceTemplatesRouter(
          zodiosCtx,
          await createDefaultEserviceTemplateService()
        );

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
