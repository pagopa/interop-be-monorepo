import {
  contextMiddleware,
  initFileManager,
  initRedisRateLimiter,
  InteropTokenGenerator,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import express from "express";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import authorizationServerRouter from "./routers/AuthorizationServerRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { TokenService, tokenServiceBuilder } from "./services/tokenService.js";
import { config } from "./config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createDefaultTokenService = async () => {
  const dynamoDBClient = new DynamoDBClient();
  const redisRateLimiter = await initRedisRateLimiter({
    limiterGroup: "AUTHSERVER",
    maxRequests: config.rateLimiterMaxRequests,
    rateInterval: config.rateLimiterRateInterval,
    burstPercentage: config.rateLimiterBurstPercentage,
    redisHost: config.rateLimiterRedisHost,
    redisPort: config.rateLimiterRedisPort,
    timeout: config.rateLimiterTimeout,
  });
  const producer = await initProducer(config, config.tokenAuditingTopic);
  const fileManager = initFileManager(config);

  const tokenGenerator = new InteropTokenGenerator({
    generatedInteropTokenKid: config.generatedInteropTokenKid,
    generatedInteropTokenIssuer: config.generatedInteropTokenIssuer,
    generatedInteropTokenM2MAudience: config.generatedInteropTokenM2MAudience,
    generatedInteropTokenM2MDurationSeconds:
      config.generatedInteropTokenM2MDurationSeconds,
  });

  return tokenServiceBuilder({
    tokenGenerator,
    dynamoDBClient,
    redisRateLimiter,
    producer,
    fileManager,
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service?: TokenService) {
  const serviceName = modelsServiceName.AUTHORIZATION_SERVER;

  const router =
    service != null
      ? authorizationServerRouter(zodiosCtx, service)
      : authorizationServerRouter(zodiosCtx, await createDefaultTokenService());

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(healthRouter);
  app.use(contextMiddleware(serviceName, false));
  app.use(express.urlencoded({ extended: true }));
  app.use(loggerMiddleware(serviceName));
  app.use(router);

  return app;
}
