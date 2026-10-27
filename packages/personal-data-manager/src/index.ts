import { startServer } from "pagopa-interop-commons";

import { createApp } from "./app.js";
import { config } from "./config/config.js";
import "./database.js";

startServer(await createApp(), config);
