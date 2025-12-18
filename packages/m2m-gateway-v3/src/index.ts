import { startServer } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import app from "./app.js";

startServer(app, config);