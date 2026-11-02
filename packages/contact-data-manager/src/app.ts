import { contactDataApi } from "pagopa-interop-api-clients";
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
import { serviceName } from "pagopa-interop-models";

import { config } from "./config/config.js";
import { contactRouter } from "./routers/contactRouter.js";
import { ContactService } from "./services/contactService.js";

const cdmServiceName = serviceName.CONTACT_DATA_MANAGER;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(
  service: ContactService,
  appConfig: typeof config = config
) {
  const app = zodiosCtx.app();
  app.disable("x-powered-by");
  app.use(healthRouter(contactDataApi.healthApi.api));
  app.use(contextMiddleware(cdmServiceName));
  app.use(await applicationAuditBeginMiddleware(cdmServiceName, appConfig));
  app.use(await applicationAuditEndMiddleware(cdmServiceName, appConfig));
  app.use(authenticationMiddleware(appConfig));
  app.use(loggerMiddleware(cdmServiceName));
  app.use(contactRouter(zodiosCtx, service));
  app.use(errorsToApiProblemsMiddleware);
  return app;
}
