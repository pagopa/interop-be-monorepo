import {
  genericLogger,
  initFileManager,
  initRedisRateLimiter,
  InteropTokenGenerator,
  startServer,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { tokenServiceBuilder } from "./services/tokenService.js";
import { AuditService } from "./services/auditService.js";

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
const fileManager = initFileManager(config);

const auditService = await AuditService.create(
  config,
  config.tokenAuditingTopic,
  fileManager,
  genericLogger
);

const tokenGenerator = new InteropTokenGenerator({
  generatedInteropTokenKid: config.generatedInteropTokenKid,
  generatedInteropTokenIssuer: config.generatedInteropTokenIssuer,
  generatedInteropTokenM2MAudience: config.generatedInteropTokenM2MAudience,
  generatedInteropTokenM2MDurationSeconds:
    config.generatedInteropTokenM2MDurationSeconds,
});

const tokenService = tokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  redisRateLimiter,
  auditService,
});

startServer(await createApp(tokenService), config);
