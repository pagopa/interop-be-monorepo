import { startServer } from "pagopa-interop-commons";

import { createApp } from "./app.js";
import { config } from "./config/config.js";

const app = await createApp();

startServer(app, config);
