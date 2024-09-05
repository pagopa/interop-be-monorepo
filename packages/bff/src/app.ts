import {
  authenticationMiddleware,
  contextMiddleware,
  initFileManager,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./providers/clientProvider.js";
import healthRouter from "./routers/HealthRouter.js";
import agreementRouter from "./routers/agreementRouter.js";
import attributeRouter from "./routers/attributeRouter.js";
import authorizationRouter from "./routers/authorizationRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import genericRouter from "./routers/genericRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import selfcareRouter from "./routers/selfcareRouter.js";
import tenantRouter from "./routers/tenantRouter.js";
import getAllowList from "./utilities/getAllowList.js";
import {
  fromFilesToBodyMiddleware,
  multerMiddleware,
} from "./utilities/middlewares.js";
import clientRouter from "./routers/clientRouter.js";
import producerKeychainRouter from "./routers/producerKeychainRouter.js";

const serviceName = "bff-process";
const fileManager = initFileManager(config);
const allowList = await getAllowList(serviceName, fileManager, config);

const clients = getInteropBeClients();

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(multerMiddleware);
app.use(fromFilesToBodyMiddleware);
app.use(contextMiddleware(serviceName, true));
app.use(healthRouter);
app.use(authorizationRouter(zodiosCtx, clients, allowList));
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(genericRouter(zodiosCtx));
app.use(catalogRouter(zodiosCtx, clients, fileManager));
app.use(attributeRouter(zodiosCtx, clients));
app.use(purposeRouter(zodiosCtx, clients));
app.use(agreementRouter(zodiosCtx));
app.use(selfcareRouter(zodiosCtx));
app.use(tenantRouter(zodiosCtx));
app.use(clientRouter(zodiosCtx, clients));
app.use(producerKeychainRouter(zodiosCtx, clients));

export default app;
