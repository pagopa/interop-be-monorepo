import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import { InteropTokenGenerator } from "pagopa-interop-commons";
import { tokenServiceBuilder } from "../src/services/tokenService.js";
import { config } from "../src/config/config.js";
import { mockKMSClient, mockProducer } from "./mockUtils.js";

export const configTokenGenerationStates = inject(
  "tokenGenerationReadModelConfig"
);

const { cleanup, fileManager, redisRateLimiter } =
  await setupTestContainersVitest(
    undefined,
    inject("fileManagerConfig"),
    undefined,
    inject("redisRateLimiterConfig")
  );

export { fileManager };

afterEach(cleanup);

if (configTokenGenerationStates === undefined) {
  throw new Error("configTokenGenerationStates is undefined");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${configTokenGenerationStates.tokenGenerationReadModelDbPort}`,
});

const tokenGenerator = new InteropTokenGenerator(
  {
    generatedInteropTokenKid: config.generatedInteropTokenKid,
    generatedInteropTokenIssuer: config.generatedInteropTokenIssuer,
    generatedInteropTokenM2MAudience: config.generatedInteropTokenM2MAudience,
    generatedInteropTokenM2MDurationSeconds:
      config.generatedInteropTokenM2MDurationSeconds,
  },
  mockKMSClient as unknown as KMSClient
);

export const tokenService = tokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  redisRateLimiter,
  producer: mockProducer as unknown as Awaited<ReturnType<typeof initProducer>>,
  fileManager,
});
