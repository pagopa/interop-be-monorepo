/* eslint-disable functional/no-let */
import "../setup.js";
import { describe, it, beforeEach, expect, vi, Mock } from "vitest";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  signatureServiceBuilder,
  SignatureReference,
  genericLogger,
} from "pagopa-interop-commons";
import { config } from "../../../src/config/config.js";

describe("signatureServiceBuilder", () => {
  let dynamoClient: DynamoDBClient;
  let signatureService: ReturnType<typeof signatureServiceBuilder>;

  beforeEach(() => {
    vi.clearAllMocks();
    dynamoClient = { send: vi.fn() } as unknown as DynamoDBClient;
    signatureService = signatureServiceBuilder(dynamoClient, config);
  });

  it("saves record correctly", async () => {
    const mockReference: SignatureReference = {
      safeStorageId: "id-1",
      fileKind: "AUDIT_EVENTS",
      fileName: "file.json",
      correlationId: "correlation-1",
    };

    await signatureService.saveSignatureReference(mockReference, genericLogger);

    const sentCommand = (dynamoClient.send as unknown as Mock).mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(PutItemCommand);
    expect(sentCommand.input.Item).toEqual({
      safeStorageId: { S: "id-1" },
      fileKind: { S: "AUDIT_EVENTS" },
      fileName: { S: "file.json" },
      correlationId: { S: "correlation-1" },
      creationTimestamp: { N: expect.any(String) },
    });
  });

  it("throws error if DynamoDBClient.send rejects", async () => {
    const mockReference: SignatureReference = {
      safeStorageId: "id-2",
      fileKind: "AUDIT_EVENTS",
      fileName: "file2.json",
      correlationId: "correlation-2",
    };

    const sendError = new Error("Dynamo error");
    (dynamoClient.send as unknown as Mock).mockRejectedValue(sendError);

    await expect(
      signatureService.saveSignatureReference(mockReference, genericLogger)
    ).rejects.toThrow("Error saving record on table");
  });
});
