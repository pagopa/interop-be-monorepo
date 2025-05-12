import { startServer } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { createApp } from "./app.js";

startServer(await createApp(), config);
