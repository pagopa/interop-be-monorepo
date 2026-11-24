import { contactDataApi } from "pagopa-interop-api-clients";
import {
  initDB,
  InteropTokenGenerator,
  RefreshableInteropToken,
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

import { createApp } from "./app.js";
import { config } from "./config/config.js";
import { contactDataManagerServiceBuilder } from "./services/contactDataManagerService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { tenantServiceBuilder } from "./services/tenantService.js";

const db = makeDrizzleConnection(config);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
const agreementReadModelServiceSQL = agreementReadModelServiceBuilder(db);
const attributeReadModelServiceSQL = attributeReadModelServiceBuilder(db);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
const delegationReadModelServiceSQL = delegationReadModelServiceBuilder(db);

const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  delegationReadModelServiceSQL
);

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();

const contactDataManagerService = contactDataManagerServiceBuilder(
  contactDataApi.createContactApiClient(config.contactDataManagerUrl, {
    axiosConfig: { timeout: config.contactDataManagerTimeoutMs },
  }),
  refreshableToken
);

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
  readModelServiceSQL,
  contactDataManagerService
);

startServer(await createApp(service), config);
