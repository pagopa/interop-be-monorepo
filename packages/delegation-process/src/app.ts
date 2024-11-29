import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
  initDB,
  initFileManager,
  initPDFGenerator,
  ReadModelRepository,
} from "pagopa-interop-commons";

import healthRouter from "./routers/HealthRouter.js";
import delegationProducerRouter from "./routers/DelegationProducerRouter.js";
import delegationRouter from "./routers/DelegationRouter.js";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import delegationConsumerRouter from "./routers/DelegationConsumerRouter.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const pdfGenerator = await initPDFGenerator();
const fileManager = initFileManager(config);

const eventStore = initDB({
  username: config.eventStoreDbUsername,
  password: config.eventStoreDbPassword,
  host: config.eventStoreDbHost,
  port: config.eventStoreDbPort,
  database: config.eventStoreDbName,
  schema: config.eventStoreDbSchema,
  useSSL: config.eventStoreDbUseSSL,
});

const serviceName = "delegation-process";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName));
app.use(authenticationMiddleware(config));
app.use(loggerMiddleware(serviceName));
app.use(delegationRouter(zodiosCtx, readModelService));
app.use(
  delegationProducerRouter(
    zodiosCtx,
    eventStore,
    readModelService,
    pdfGenerator,
    fileManager
  )
);
app.use(
  delegationConsumerRouter(
    zodiosCtx,
    eventStore,
    readModelService,
    pdfGenerator,
    fileManager
  )
);

export default app;
