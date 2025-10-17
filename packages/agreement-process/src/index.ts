import {
  initDB,
  initFileManager,
  initPDFGenerator,
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
import { agreementServiceBuilder } from "./services/agreementService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const db = makeDrizzleConnection(config);
const agreementReadModelServiceSQL = agreementReadModelServiceBuilder(db);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
const attributeReadModelServiceSQL = attributeReadModelServiceBuilder(db);
const delegationReadModelServiceSQL = delegationReadModelServiceBuilder(db);

const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL
);

const pdfGenerator = await initPDFGenerator();

const service = agreementServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelServiceSQL,
  initFileManager(config),
  pdfGenerator
);

startServer(await createApp(service), config);
