import { makeApi } from "@zodios/core";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import {
  authenticationMiddleware,
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { ProblemSchema, serviceName } from "pagopa-interop-models";

import { config } from "./config/config.js";

const cdmServiceName = serviceName.CONTACT_DATA_MANAGER;
const healthApi = makeApi([
  { method: "get", path: "/status", response: ProblemSchema },
]);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp() {
  const app = zodiosCtx.app();
  app.disable("x-powered-by");
  app.use(healthRouter(healthApi));
  app.use(contextMiddleware(cdmServiceName));
  app.use(await applicationAuditBeginMiddleware(cdmServiceName, config));
  app.use(await applicationAuditEndMiddleware(cdmServiceName, config));
  app.use(authenticationMiddleware(config));
  app.use(loggerMiddleware(cdmServiceName));
  app.use(errorsToApiProblemsMiddleware);
  return app;
}
