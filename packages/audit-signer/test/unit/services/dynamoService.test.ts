/* eslint-disable functional/no-let */
import "../setup.js";
import { describe, it, beforeEach, expect, vi, Mock } from "vitest";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { dbServiceBuilder } from "../../../src/services/dynamoService.js";

describe("dbServiceBuilder", () => {
  let dynamoClient: DynamoDBClient;
  let dbService: ReturnType<typeof dbServiceBuilder>;

  beforeEach(() => {
    vi.clearAllMocks();
    dynamoClient = { send: vi.fn() } as unknown as DynamoDBClient;
    dbService = dbServiceBuilder(dynamoClient);
  });

  it("saves record correctly", async () => {
    const mockReference = {
      safeStorageId: "id-1",
      fileKind: "AUDIT_EVENTS",
      fileName: "file.json",
      correlationId: "correlation-1",
    };

    await dbService.saveSignatureReference(mockReference);

    const sentCommand = (dynamoClient.send as unknown as Mock).mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(PutItemCommand);
    expect(sentCommand.input.Item).toEqual({
      safeStorageId: { S: "id-1" },
      fileKind: { S: "AUDIT_EVENTS" },
      fileName: { S: "file.json" },
      correlationId: { S: "correlation-1" },
    });
  });

  it("throws error if DynamoDBClient.send rejects", async () => {
    const mockReference = {
      safeStorageId: "id-2",
      fileKind: "AUDIT_EVENTS",
      fileName: "file2.json",
      correlationId: "correlation-2",
    };

    const sendError = new Error("Dynamo error");
    (dynamoClient.send as unknown as Mock).mockRejectedValue(sendError);

    await expect(
      dbService.saveSignatureReference(mockReference)
    ).rejects.toThrow("Error saving record on table");
  });
});
