import "../setup.js";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { Message } from "@aws-sdk/client-sqs";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { sqsMessageHandler } from "../../../src/handlers/sqsMessageHandler.js";
import {
  mockFileManager,
  mockDbService,
  mockSafeStorageService,
} from "../setup.js";
import * as decodeModule from "../../../src/utils/decodeSQSEventMessage.js";

import { gzipBuffer } from "../../../src/utils/compression.js";

describe("sqsMessageHandler", () => {
  const mockCorrelationId = "mock-correlation-id" as CorrelationId;
  const mockS3Key = "path/to/my-audit-file.json";

  vi.mock("../../../src/utils/decodeSQSEventMessage.js", () => ({
    decodeSQSEventMessage: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully processes a message", async () => {
    const mockMessage: Message = { Body: "test" };

    vi.mocked(generateId).mockReturnValue(mockCorrelationId);
    vi.mocked(decodeModule.decodeSQSEventMessage).mockReturnValue(mockS3Key);
    vi.mocked(mockFileManager.get).mockResolvedValue(
      Buffer.from("file content")
    );
    vi.mock("../../../src/utils/compression.js", () => ({
      gzipBuffer: vi.fn(),
    }));
    vi.mocked(gzipBuffer).mockResolvedValue(Buffer.from("gzipped content"));
    vi.mock("../../../src/utils/checksum.js", () => ({
      calculateSha256Base64: vi.fn(),
    }));
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

    expect(mockDbService.saveSignatureReference).toHaveBeenCalledWith(
      {
        safeStorageId: "mock-key",
        fileKind: "VOUCHER_AUDIT",
        fileName: "my-audit-file.json",
        correlationId: mockCorrelationId,
        path: "path/to",
      },
      expect.any(Object)
    );
  });
});
