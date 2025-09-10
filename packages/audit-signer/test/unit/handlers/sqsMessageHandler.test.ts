import "../setup";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { Message } from "@aws-sdk/client-sqs";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { sqsMessageHandler } from "../../../src/handlers/sqsMessageHandler.js";
import {
  mockFileManager,
  mockDbService,
  mockSafeStorageService,
} from "../setup.js";
import { decodeSQSEventMessage } from "../../../src/utils/decodeSQSEventMessage.js";
import { gzipBuffer } from "../../../src/utils/compression.js";
import { calculateSha256Base64 } from "../../../src/utils/checksum.js";

describe("sqsMessageHandler", () => {
  const mockCorrelationId = "mock-correlation-id" as CorrelationId;
  const mockS3Key = "path/to/my-audit-file.json";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully processes a message", async () => {
    const mockMessage: Message = { Body: "test" };

    vi.mocked(generateId).mockReturnValue(mockCorrelationId);
    vi.mocked(decodeSQSEventMessage).mockReturnValue(mockS3Key);
    vi.mocked(mockFileManager.get).mockResolvedValue(
      Buffer.from("file content")
    );
    vi.mocked(gzipBuffer).mockResolvedValue(Buffer.from("gzipped content"));
    vi.mocked(calculateSha256Base64).mockResolvedValue("mock-checksum");
    vi.mocked(mockSafeStorageService.createFile).mockResolvedValue({
      uploadUrl: "mock-upload-url",
      secret: "mock-secret",
      key: "mock-key",
      uploadMethod: "PUT",
    });

    await sqsMessageHandler(
      mockMessage,
      mockFileManager,
      mockDbService,
      mockSafeStorageService
    );

    expect(mockDbService.saveSignatureReference).toHaveBeenCalledWith({
      safeStorageId: "mock-key",
      fileKind: "AUDIT_EVENTS",
      fileName: "my-audit-file.json",
      correlationId: mockCorrelationId,
    });
  });
});
