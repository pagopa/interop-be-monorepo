import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { FileManager, SafeStorageService } from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import { SignatureServiceBuilder } from "pagopa-interop-commons";
import { sqsMessageHandler } from "../src/handlers/sqsMessageHandler.js";

vi.mock("../src/config/config.js", () => ({
  config: {
    serviceName: "test-service",
    s3Bucket: "test-bucket",
    dbTableName: "test-table",
  },
}));

const mockFileManager: Partial<FileManager> = {
  storeBytes: vi.fn(),
};

const mockDbService: SignatureServiceBuilder = {
  saveSignatureReference: vi.fn(),
  saveDocumentSignatureReference: vi.fn(),
  readSignatureReference: vi.fn(),
  deleteSignatureReference: vi.fn(),
};

const mockSafeStorageService: SafeStorageService = {
  createFile: vi.fn(),
  uploadFileContent: vi.fn(),
  getFile: vi.fn(),
  downloadFileContent: vi.fn(),
};

describe("sqsMessageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process the message successfully and delete the record", async () => {
    const sqsMessageBody = {
      version: "0",
      id: "6e902b1c-7f55-4074-a036-749e75551f33",
      "detail-type": "Object Created",
      source: "aws.s3",
      account: "123456789012",
      time: "2025-01-01T10:00:00Z",
      region: "eu-central-1",
      resources: ["arn:aws:s3:::some-bucket"],
      detail: {
        key: "test-file-key.pdf",
        versionId: "12345",
        documentType: "INTEROP_LEGAL_FACTS",
        documentStatus: "SAVED",
        contentType: "application/pdf",
        checksum: "mock-checksum",
        retentionUntil: "2026-01-01T10:00:00Z",
        tags: null,
        client_short_code: "12345",
      },
    };

    const sqsMessagePayload: Message = {
      Body: JSON.stringify(sqsMessageBody),
    };

    const mockFileReference = {
      download: { url: "http://mock-download-url.com/file" },
    };
    const mockFileContent = Buffer.from("test content");
    const mockS3Key = "12345/2025/01/01/test-file-key.pdf";

    (mockSafeStorageService.getFile as Mock).mockResolvedValueOnce(
      mockFileReference
    );
    (mockSafeStorageService.downloadFileContent as Mock).mockResolvedValueOnce(
      mockFileContent
    );
    (mockFileManager.storeBytes as Mock).mockResolvedValueOnce(mockS3Key);
    (mockDbService.deleteSignatureReference as Mock).mockResolvedValueOnce(
      void 0
    );

    await sqsMessageHandler(
      sqsMessagePayload,
      mockFileManager as FileManager,
      mockDbService,
      mockSafeStorageService
    );

    expect(mockSafeStorageService.getFile).toHaveBeenCalledWith(
      sqsMessageBody.detail.key
    );

    expect(mockFileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: "test-bucket",
        path: "12345/2025/01/01",
        name: "test-file-key.pdf",
        content: mockFileContent,
      },
      expect.any(Object)
    );

    expect(mockDbService.deleteSignatureReference).toHaveBeenCalledWith(
      sqsMessageBody.id
    );
  });

  it("should throw an error and not call other services if the SQS message is invalid", async () => {
    const invalidSqsMessagePayload: Message = {
      Body: JSON.stringify({ invalid: "payload" }),
    };

    await expect(
      sqsMessageHandler(
        invalidSqsMessagePayload,
        mockFileManager as FileManager,
        mockDbService,
        mockSafeStorageService
      )
    ).rejects.toThrow("Invalid SQS payload");

    expect(mockSafeStorageService.getFile).not.toHaveBeenCalled();
    expect(mockFileManager.storeBytes).not.toHaveBeenCalled();
    expect(mockDbService.deleteSignatureReference).not.toHaveBeenCalled();
  });
});
