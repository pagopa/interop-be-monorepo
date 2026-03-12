import { initDB, initFileManager, startServer } from "pagopa-interop-commons";
import {
  makeDrizzleConnection,
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { catalogServiceBuilder } from "./services/catalogService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const db = makeDrizzleConnection(config);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(db);

const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  eserviceTemplateReadModelServiceSQL
);

const catalogService = catalogServiceBuilder(
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
  initFileManager(config)
);

startServer(await createApp(catalogService), config);
