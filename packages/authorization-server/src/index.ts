import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import {
  initFileManager,
  initRedisRateLimiter,
  InteropTokenGenerator,
  startServer,
} from "pagopa-interop-commons";

import { createApp } from "./app.js";
import { config } from "./config/config.js";
import { asyncTokenServiceBuilder } from "./services/asyncTokenService.js";
import { tokenServiceBuilder } from "./services/tokenService.js";

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
const consumerTokenAuditProducer = await initProducer(
  config,
  config.consumerTokenAuditingTopic,
  config.featureFlagConfluentKafka
);
const apiTokenAuditProducer = await initProducer(
  config,
  config.apiTokenAuditingTopic,
  config.featureFlagConfluentKafka
);
const fileManager = initFileManager(config);

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
  consumerTokenAuditProducer,
  apiTokenAuditProducer,
  fileManager,
});

const asyncTokenService = asyncTokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  redisRateLimiter,
  consumerTokenAuditProducer,
  fileManager,
});

startServer(await createApp(tokenService, asyncTokenService), config);
