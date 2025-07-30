import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "../../src/config/config";
import {
  buildDynamoDBTable,
  deleteDynamoDBTable,
  readSignatureReference,
} from "../utils/dbServiceUtils";
import { dbServiceBuilder } from "../../src/services/dbService";

describe("dbServiceBuilder - Integration Tests", () => {
  let dynamoDBClient: DynamoDBClient;
  const testTableName = config.dbTableName;

  beforeAll(() => {
    dynamoDBClient = new DynamoDBClient({
      region: "eu-south-1",
      endpoint: "http://localhost:8085",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
  });

  beforeEach(async () => {
    await buildDynamoDBTable(dynamoDBClient, testTableName);
  });

  afterEach(async () => {
    await deleteDynamoDBTable(dynamoDBClient, testTableName);
  });

  afterAll(() => {
    dynamoDBClient.destroy();
  });

  it("should successfully save a signature reference and retrieve it", async () => {
    const dbService = dbServiceBuilder(dynamoDBClient);
    const mockReference = {
      safeStorageId: "test-id-integration-1",
      fileKind: "INTEGRATION_TEST_KIND",
      fileName: "integration-test-file.txt",
    };

    await dbService.saveSignatureReference(mockReference);

    const retrievedItem = await readSignatureReference(
      mockReference.safeStorageId,
      dynamoDBClient,
    );

    expect(retrievedItem).toEqual(mockReference);
  });

  it("should return undefined if a signature reference does not exist", async () => {
    const nonExistentId = "non-existent-id";

    const retrievedItem = await readSignatureReference(
      nonExistentId,
      dynamoDBClient,
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

    await expect(
      readSignatureReference("any-id-for-error-read", brokenDynamoDBClient),
    ).rejects.toThrow();
  });
});
