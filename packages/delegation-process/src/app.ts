import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
  initDB,
  initFileManager,
  initPDFGenerator,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import healthRouter from "./routers/HealthRouter.js";
import delegationRouter from "./routers/DelegationRouter.js";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  delegationReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
});
const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const pdfGenerator = await initPDFGenerator();
const fileManager = initFileManager(config);

const eventStore = initDB({
  username: config.eventStoreDbUsername,
  password: config.eventStoreDbPassword,
  host: config.eventStoreDbHost,
  port: config.eventStoreDbPort,
  database: config.eventStoreDbName,
  schema: config.eventStoreDbSchema,
  useSSL: config.eventStoreDbUseSSL,
});

const serviceName = modelsServiceName.DELEGATION_PROCESS;

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
app.use(
  delegationRouter(
    zodiosCtx,
    readModelService,
    eventStore,
    pdfGenerator,
    fileManager
  )
);

export default app;
