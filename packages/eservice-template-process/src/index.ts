import { startServer } from "pagopa-interop-commons";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { ReadModelRepository } from "pagopa-interop-commons";
import { initDB, initFileManager } from "pagopa-interop-commons";
import {
  attributeReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { eserviceTemplateServiceBuilder } from "./services/eserviceTemplateService.js";
import { createApp } from "./app.js";

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
  readModelService,
  initFileManager(config)
);
startServer(await createApp(service), config);
