import { startServer } from "pagopa-interop-commons";
import { initDB } from "pagopa-interop-commons";
import {
  makeDrizzleConnection,
  notificationConfigReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { notificationConfigServiceBuilder } from "./services/notificationConfigService.js";

const readModelDB = makeDrizzleConnection(config);
const notificationConfigReadModelService =
  notificationConfigReadModelServiceBuilder(readModelDB);

const service = notificationConfigServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  notificationConfigReadModelService
);
startServer(await createApp(service), config);
