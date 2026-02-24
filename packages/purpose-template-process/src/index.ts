import { initDB, initFileManager, startServer } from "pagopa-interop-commons";
import {
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  purposeTemplateReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { createApp } from "./app.js";
import { purposeTemplateServiceBuilder } from "./services/purposeTemplateService.js";

const readModelDB = makeDrizzleConnection(config);
const fileManager = initFileManager(config);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeTemplateReadModelServiceSQL =
  purposeTemplateReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
});

const service = purposeTemplateServiceBuilder(
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
  fileManager
);

startServer(await createApp(service), config);
