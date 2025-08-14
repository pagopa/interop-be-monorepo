import { initDB, startServer } from "pagopa-interop-commons";
import {
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";

import { createApp } from "./app.js";
import { purposeTemplateServiceBuilder } from "./services/purposeTemplateService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL: tenantReadModelServiceBuilder(readModelDB),
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
  readModelServiceSQL
);

startServer(await createApp(service), config);
