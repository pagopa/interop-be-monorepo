/* eslint-disable functional/no-let */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { generateId } from "pagopa-interop-models";
import { Logger, signatureServiceBuilder } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { dynamoDBClient } from "../utils/utils.js";
import { config } from "../../src/config/config.js";
let logger: Logger;
describe("signatureServiceBuilder - Integration Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should successfully save a signature reference and retrieve it", async () => {
    const safeStorageId = generateId();
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "multa.pdf",
      correlationId: generateId(),
      creationTimestamp: expect.any(Number),
    };

    await signatureService.saveSignatureReference(mockReference, logger);

    const retrievedItem = await signatureService.readSignatureReference(
      mockReference.safeStorageId,
      logger
    );

    expect(retrievedItem).toEqual({
      ...mockReference,
      safeStorageId: mockReference.safeStorageId,
    });
  });

  it("should return undefined if a signature reference does not exist", async () => {
    const nonExistentId = generateId();
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const retrievedItem = await signatureService.readSignatureReference(
      nonExistentId,
      logger
    );

    expect(retrievedItem).toBeUndefined();
  });

  it("should handle error when reading from DynamoDB", async () => {
    const brokenDynamoDBClient = new DynamoDBClient({
      region: "eu-south-1",
      endpoint: "http://localhost:9999",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
    const signatureService = signatureServiceBuilder(
      brokenDynamoDBClient,
      config
    );
    await expect(
      signatureService.readSignatureReference(generateId(), logger)
    ).rejects.toThrow();
  });
});
