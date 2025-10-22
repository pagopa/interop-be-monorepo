import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { generateId } from "pagopa-interop-models";
import {
  SignatureReference,
  signatureServiceBuilder,
} from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { getUnixTime } from "date-fns";
import { dynamoDBClient } from "../utils/utils.js";
import { config } from "../../src/config/config.js";

describe("signatureServiceBuilder - Integration Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should successfully delete logically and still retrieve it", async () => {
    const safeStorageId = generateId();
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "multa.pdf",
      correlationId: generateId(),
      creationTimestamp: getUnixTime(new Date()),
    };

    await signatureService.saveSignatureReference(mockReference);

    await signatureService.deleteSignatureReference(
      mockReference.safeStorageId
    );

    const retrievedItem = await signatureService.readSignatureReference(
      mockReference.safeStorageId
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
      nonExistentId
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
      signatureService.readSignatureReference(generateId())
    ).rejects.toThrow();
  });

  it("should successfully save and retrieve a SignatureReference with timestamp", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const safeStorageId = generateId();
    const mockReference: SignatureReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "contratto.pdf",
      correlationId: generateId(),
      creationTimestamp: getUnixTime(new Date()),
    };

    await signatureService.saveSignatureReference(mockReference);

    const retrieved = await signatureService.readSignatureReference(
      safeStorageId
    );

    expect(retrieved).toBeDefined();
    expect(retrieved?.safeStorageId).toBe(mockReference.safeStorageId);
    expect(retrieved?.fileKind).toBe(mockReference.fileKind);
    expect(retrieved?.creationTimestamp).toBe(mockReference.creationTimestamp);
  });

  it("should throw genericInternalError if the item in DynamoDB is malformed", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const malformedId = "malformed-ID";

    const command = {
      TableName: config.signatureReferencesTableName,
      Item: {
        safeStorageId: { S: malformedId },
        fileName: { S: "invalid.pdf" },
        correlationId: { S: "correlation-1" },
        // 'fileKind' intentionally missing
      },
    };

    // Use the raw DynamoDB client to simulate a corrupted entry
    await dynamoDBClient.send(new PutItemCommand(command));

    const expectedMessage = `Error reading signature reference with id='${malformedId}' from table 'SignatureReferencesTable': Error: Malformed item in table 'SignatureReferencesTable' for id='${malformedId}'`;

    await expect(
      signatureService.readSignatureReference(malformedId)
    ).rejects.toThrow(expectedMessage);
  });

  it("should correctly set 'ttl' and 'logicallyDeleted' fields on deleteSignatureReference", async () => {
    const signatureService = signatureServiceBuilder(dynamoDBClient, config);
    const safeStorageId = generateId();
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "atto.pdf",
      correlationId: generateId(),
    };

    await signatureService.saveSignatureReference(mockReference);

    await signatureService.deleteSignatureReference(
      mockReference.safeStorageId
    );

    // Read raw item from DynamoDB
    const result = await dynamoDBClient.send(
      new GetItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: safeStorageId } },
      })
    );

    const item = result.Item;

    expect(item).toBeDefined();
    expect(item?.ttl?.N).toBeDefined();
    expect(Number(item?.ttl?.N)).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(item?.logicallyDeleted?.BOOL ?? item?.logicallyDeleted?.N).toBe(
      true
    );
  });
});
