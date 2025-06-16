import { startServer } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { inAppNotificationServiceBuilder } from "./services/inAppNotificationService.js";

const service = inAppNotificationServiceBuilder();
startServer(await createApp(service), config);
