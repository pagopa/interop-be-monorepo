import {
  authenticationMiddleware,
  contextMiddleware,
  initDB,
  ReadModelRepository,
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
  clientReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  producerKeychainReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import healthRouter from "./routers/HealthRouter.js";
import authorizationRouter from "./routers/AuthorizationRouter.js";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./services/authorizationService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultAuthorizationService = async () => {
  const readModelDB = makeDrizzleConnection(config);
  const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);
  const catalogReadModelServiceSQL =
    catalogReadModelServiceBuilder(readModelDB);
  const purposeReadModelServiceSQL =
    purposeReadModelServiceBuilder(readModelDB);
  const agreementReadModelServiceSQL =
    agreementReadModelServiceBuilder(readModelDB);
  const producerKeychainReadModelServiceSQL =
    producerKeychainReadModelServiceBuilder(readModelDB);
  const delegationReadModelServiceSQL =
    delegationReadModelServiceBuilder(readModelDB);

  const oldreadModelServiceSQL = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const readModelServiceSQL = readModelServiceBuilderSQL({
    readModelDB,
    clientReadModelServiceSQL,
    catalogReadModelServiceSQL,
    purposeReadModelServiceSQL,
    agreementReadModelServiceSQL,
    producerKeychainReadModelServiceSQL,
    delegationReadModelServiceSQL,
  });

  const readModelService =
    config.featureFlagSQL &&
    config.readModelSQLDbHost &&
    config.readModelSQLDbPort
      ? readModelServiceSQL
      : oldreadModelServiceSQL;

  return authorizationServiceBuilder(
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
    selfcareV2InstitutionClientBuilder(config)
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: AuthorizationService) {
  const serviceName = modelsServiceName.AUTHORIZATION_PROCESS;

  const router =
    service != null
      ? authorizationRouter(zodiosCtx, service)
      : authorizationRouter(
          zodiosCtx,
          await createDefaultAuthorizationService()
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
  app.use(router);

  return app;
}
