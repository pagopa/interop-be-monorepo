import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { createInstance } from "@featurevisor/sdk";
import { DatafileContent } from "@featurevisor/types";
import eservicesRouter from "./routers/EServiceRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";

const serviceName = "catalog-process";

const app = zodiosCtx.app();

const datafileUrl = "http://127.0.0.1:8080/dev/datafile-tag-all.json";
const datafileContent = await fetch(datafileUrl).then((res) => res.json());

const featureInstance = createInstance({
  datafile: datafileContent as DatafileContent,
});

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName));
app.use(authenticationMiddleware(config));
app.use(loggerMiddleware(serviceName));
app.use(eservicesRouter(zodiosCtx, featureInstance));

export default app;
