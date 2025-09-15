import {
  ReadModelRepository,
  initDB,
  initFileManager,
  initPDFGenerator,
  startServer,
} from "pagopa-interop-commons";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { delegationServiceBuilder } from "./services/delegationService.js";

const fileManager = initFileManager(config);
const pdfGenerator = await initPDFGenerator();

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

const service = delegationServiceBuilder(
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
  pdfGenerator,
  fileManager
);

startServer(await createApp(service), config);
