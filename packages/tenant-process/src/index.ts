import {
  ReadModelRepository,
  initDB,
  startServer,
} from "pagopa-interop-commons";
import {
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { tenantServiceBuilder } from "./services/tenantService.js";

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

const service = tenantServiceBuilder(
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

startServer(await createApp(service), config);
