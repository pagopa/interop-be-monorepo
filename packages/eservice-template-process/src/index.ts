import { startServer } from "pagopa-interop-commons";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { initDB, initFileManager } from "pagopa-interop-commons";
import {
  attributeReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { eserviceTemplateServiceBuilder } from "./services/eserviceTemplateService.js";
import { createApp } from "./app.js";

const readModelDB = makeDrizzleConnection(config);
const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  eserviceTemplateReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
});

const service = eserviceTemplateServiceBuilder(
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
startServer(await createApp(service), config);
