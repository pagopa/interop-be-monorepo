import { startServer } from "pagopa-interop-commons";

import app from "./app.js";
import { config } from "./config/config.js";

startServer(app, config);
