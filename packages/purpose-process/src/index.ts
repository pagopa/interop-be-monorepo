import { drizzle } from "drizzle-orm/node-postgres";
import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import { initDB, startServer } from "pagopa-interop-commons";
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
import pg from "pg";

import { createApp } from "./app.js";
import { config } from "./config/config.js";
import { purposeServiceBuilder } from "./services/purposeService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const tenantKindHistoryDB = drizzle({
  client: new pg.Pool({
    host: config.tenantKindHistoryDBHost,
    port: config.tenantKindHistoryDBPort,
    database: config.tenantKindHistoryDBName,
    user: config.tenantKindHistoryDBUsername,
    password: config.tenantKindHistoryDBPassword,
    ssl: config.tenantKindHistoryDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  }),
});
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
  tenantKindHistoryDB,
});

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
  selfcareV2InstitutionClientBuilder(config)
);

startServer(await createApp(service), config);
