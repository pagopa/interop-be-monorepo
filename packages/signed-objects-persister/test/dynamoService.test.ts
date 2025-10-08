import { describe, it, expect, vi, Mock } from "vitest";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { signatureServiceBuilder } from "pagopa-interop-commons";
import { config } from "../src/config/config.js";

const mockDynamoDBClient = {
  send: vi.fn(),
} as unknown as DynamoDBClient;

describe("signatureServiceBuilder - Unit Test for Deletion", () => {
  it("should successfully delete a document from DynamoDB", async () => {
    (mockDynamoDBClient.send as Mock).mockImplementationOnce(
      async (command) => {
        if (command instanceof UpdateItemCommand) {
          return {};
        }
        throw new Error("Unexpected command received by mock client");
      }
    );

    const signatureService = signatureServiceBuilder(
      mockDynamoDBClient,
      config
    );
    const safeStorageId = "mocked-id-to-delete";
    await signatureService.deleteSignatureReference(safeStorageId);

    const firstCall = (mockDynamoDBClient.send as Mock).mock.calls[0][0];
    expect(firstCall).toBeInstanceOf(UpdateItemCommand);
  });
});
