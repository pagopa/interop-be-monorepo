import {
  initFileManager,
  initRedisRateLimiter,
  InteropTokenGenerator,
  startServer,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { tokenServiceBuilder } from "./services/tokenService.js";
import { asyncTokenServiceBuilder } from "./services/asyncTokenService.js";

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

const tokenService = tokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  redisRateLimiter,
  producer,
  fileManager,
});

const asyncTokenService = asyncTokenServiceBuilder({
  dynamoDBClient,
  redisRateLimiter,
  producer,
  fileManager,
});

startServer(await createApp(tokenService, asyncTokenService), config);
