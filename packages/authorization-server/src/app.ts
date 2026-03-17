import {
  contextMiddleware,
  errorsToApiProblemsMiddleware,
  healthRouter,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import express from "express";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import {
  applicationAuditAuthorizationServerEndMiddleware,
  applicationAuditBeginMiddleware,
} from "pagopa-interop-application-audit";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import authorizationServerRouter from "./routers/AuthorizationServerRouter.js";
import asyncAuthorizationServerRouter from "./routers/AsyncAuthorizationServerRouter.js";
import { config } from "./config/config.js";
import { TokenService } from "./services/tokenService.js";
import { AsyncTokenService } from "./services/asyncTokenService.js";
import { asyncExchangeFeatureFlagMiddleware } from "./utilities/middleware.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(
  service: TokenService,
  asyncService: AsyncTokenService
) {
  const serviceName = modelsServiceName.AUTHORIZATION_SERVER;

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(
    "/authorization-server",
    healthRouter(authorizationServerApi.healthApi.api),
    contextMiddleware(serviceName, false),
    await applicationAuditBeginMiddleware(serviceName, config),
    await applicationAuditAuthorizationServerEndMiddleware(serviceName, config),
    express.urlencoded({ extended: true }),
    loggerMiddleware(serviceName),
    authorizationServerRouter(zodiosCtx, service),
    asyncExchangeFeatureFlagMiddleware(),
    asyncAuthorizationServerRouter(zodiosCtx, asyncService)
  );

  app.use(errorsToApiProblemsMiddleware);

  return app;
}
