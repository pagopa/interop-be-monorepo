import { startServer } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";

const clients = getInteropBeClients();
const app = await createApp({ clients });

startServer(app, config);
