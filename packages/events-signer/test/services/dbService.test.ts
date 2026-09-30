/* eslint-disable functional/no-let */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericLogger, signatureServiceBuilder } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils/utils.js";
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
      path: "path/to",
    };

    await signatureService.saveSignatureReference(mockReference, genericLogger);

    const retrievedItem = await signatureService.readSignatureReference(
      mockReference.safeStorageId,
      genericLogger
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
      genericLogger
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
      signatureService.readSignatureReference(generateId(), genericLogger)
    ).rejects.toThrow();
  });
});
