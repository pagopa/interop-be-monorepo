import {
  initDB,
  initFileManager,
  initPDFGenerator,
  startServer,
} from "pagopa-interop-commons";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  clientReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  purposeReadModelServiceBuilder,
  purposeTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { purposeServiceBuilder } from "./services/purposeService.js";

const readModelDB = makeDrizzleConnection(config);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const purposeTemplateReadModelServiceSQL =
  purposeTemplateReadModelServiceBuilder(readModelDB);
const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  purposeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  delegationReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
  clientReadModelServiceSQL,
});

const fileManager = initFileManager(config);
const pdfGenerator = await initPDFGenerator();

const service = purposeServiceBuilder(
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
  fileManager,
  pdfGenerator
);

startServer(await createApp(service), config);
