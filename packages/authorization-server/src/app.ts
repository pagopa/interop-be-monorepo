import {
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import express from "express";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import {
  applicationAuditAuthorizationServerEndMiddleware,
  applicationAuditBeginMiddleware,
} from "pagopa-interop-application-audit";
import healthRouter from "./routers/HealthRouter.js";
import authorizationServerRouter from "./routers/AuthorizationServerRouter.js";
import { config } from "./config/config.js";
import { TokenService } from "./services/tokenService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: TokenService) {
  const serviceName = modelsServiceName.AUTHORIZATION_SERVER;

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter);
  app.use(contextMiddleware(serviceName, false));
  app.use(await applicationAuditBeginMiddleware(serviceName, config));
  app.use(
    await applicationAuditAuthorizationServerEndMiddleware(serviceName, config)
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(loggerMiddleware(serviceName));
  app.use(authorizationServerRouter(zodiosCtx, service));

  return app;
}
