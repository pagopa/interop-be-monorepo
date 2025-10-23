/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import {
  signatureServiceBuilder,
  DocumentSignatureReference,
} from "pagopa-interop-commons";
import { config } from "../../src/config/config.js";
import { dynamoDBClient } from "../utils.js";

describe("dbServiceBuilder integration with DynamoDB", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await buildDynamoDBTables(dynamoDBClient);
  });

  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });
  const signatureService = signatureServiceBuilder(dynamoDBClient, config);

  it("should build the DB service", () => {
    expect(signatureService).toBeDefined();
  });

  it("should write and read a DocumentReference", async () => {
    const doc: DocumentSignatureReference = {
      safeStorageId: "key-123",
      fileKind: "pdf",
      streamId: "stream-456",
      subObjectId: "sub-789",
      fileName: "document.pdf",
      version: 1,
      contentType: "application/pdf",
      path: "test/test/test.pdf",
      prettyname: "prettyname",
      createdAt: BigInt(0),
    };

    await signatureService.saveDocumentSignatureReference(doc);

    const resp = await dynamoDBClient.send(
      new GetItemCommand({
        TableName: config.signatureReferencesTableName,
        Key: { safeStorageId: { S: doc.safeStorageId } },
      })
    );

    expect(resp.Item).toBeDefined();
    expect(resp.Item?.fileName.S).toBe(doc.fileName);
    expect(Number(resp.Item?.version.N)).toBe(doc.version);
    expect(resp.Item?.safeStorageId.S).toBe(doc.safeStorageId);
  });
});
