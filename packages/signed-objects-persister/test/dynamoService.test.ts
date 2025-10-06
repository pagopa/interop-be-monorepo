import { describe, it, expect, vi, Mock } from "vitest";
import { DeleteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { dbServiceBuilder } from "../src/services/dynamoService.js";
import { config } from "../src/config/config.js";

const mockDynamoDBClient = {
  send: vi.fn(),
} as unknown as DynamoDBClient;

describe("dbServiceBuilder - Unit Test for Deletion", () => {
  it("should successfully delete a document from DynamoDB", async () => {
    (mockDynamoDBClient.send as Mock).mockImplementationOnce(
      async (command) => {
        if (command instanceof DeleteItemCommand) {
          return {};
        }
        throw new Error("Unexpected command received by mock client");
      }
    );

    const dbService = dbServiceBuilder(mockDynamoDBClient);
    const safeStorageId = "mocked-id-to-delete";
    await dbService.deleteFromDynamo(safeStorageId);

    const firstCall = (mockDynamoDBClient.send as Mock).mock.calls[0][0];
    expect(firstCall).toBeInstanceOf(DeleteItemCommand);

    expect(firstCall.input).toEqual({
      TableName: config.dbTableName,
      Key: {
        safeStorageId: { S: safeStorageId },
      },
    });
  });
});
