import { startServer } from "pagopa-interop-commons";
import { initDB } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { notificationConfigServiceBuilder } from "./services/notificationConfigService.js";

const service = notificationConfigServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  })
);
startServer(await createApp(service), config);
