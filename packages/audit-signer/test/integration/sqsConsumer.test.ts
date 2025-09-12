/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-empty-function */
import "../unit/setup.js";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { Message } from "@aws-sdk/client-sqs";
import { sqsMessageHandler } from "../../src/handlers/sqsMessageHandler.js";
import * as decodeModule from "../../src/utils/decodeSQSEventMessage.js";
import * as gzipModule from "../../src/utils/compression.js";
import * as checksumModule from "../../src/utils/checksum.js";
import {
  mockDbService,
  mockFileManager,
  mockSafeStorageService,
  mockLoggerInstance,
} from "../unit/setup.js";

describe("Integration test (mocked AWS)", () => {
  const mockMessage: Message = {
    MessageId: "msg-1",
    Body: JSON.stringify({
      Records: [
        {
          s3: {
            bucket: { name: "mock-bucket" },
            object: { key: "mock-key.json" },
          },
        },
      ],
    }),
  };

  const mockS3Key = "mock-key.json";

  beforeEach(() => {
    vi.clearAllMocks();

    mockFileManager.get = vi.fn();
    mockFileManager.delete = vi.fn();
    mockFileManager.copy = vi.fn();
    mockFileManager.storeBytes = vi.fn();
    mockFileManager.storeBytesByKey = vi.fn();
    mockFileManager.listFiles = vi.fn();
    mockFileManager.generateGetPresignedUrl = vi.fn();
    mockFileManager.generatePutPresignedUrl = vi.fn();

    mockDbService.saveSignatureReference = vi.fn();

    mockSafeStorageService.createFile = vi.fn();
    mockSafeStorageService.uploadFileContent = vi.fn();

    vi.spyOn(decodeModule, "decodeSQSEventMessage").mockReturnValue(mockS3Key);
    vi.spyOn(gzipModule, "gzipBuffer").mockResolvedValue(
      Buffer.from("gzipped content")
    );
    vi.spyOn(checksumModule, "calculateSha256Base64").mockResolvedValue(
      "mock-checksum"
    );

    mockLoggerInstance.info = vi.fn();
    mockLoggerInstance.error = vi.fn();
    mockLoggerInstance.warn = vi.fn();
    mockLoggerInstance.debug = vi.fn();
    mockLoggerInstance.isDebugEnabled = vi.fn().mockReturnValue(true);
  });

  it("processes an SQS message and saves to DynamoDB", async () => {
    mockSafeStorageService.createFile.mockResolvedValueOnce({ id: "file-id" });
    (
      mockFileManager.get as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(Buffer.from("file content"));
    mockDbService.saveSignatureReference.mockResolvedValueOnce(undefined);

    await sqsMessageHandler(
      mockMessage,
      mockFileManager,
      mockDbService,
      mockSafeStorageService
    );

    expect(mockFileManager.get).toHaveBeenCalledWith(
      "bucket-name",
      "mock-key.json",
      expect.any(Object)
    );

    expect(mockSafeStorageService.createFile).toHaveBeenCalled();
    expect(mockSafeStorageService.uploadFileContent).toHaveBeenCalled();
    expect(mockDbService.saveSignatureReference).toHaveBeenCalled();
  });

  it("handles DynamoDB errors gracefully", async () => {
    mockSafeStorageService.createFile.mockResolvedValueOnce({ id: "file-id" });
    (
      mockFileManager.get as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(Buffer.from("file content"));
    mockSafeStorageService.uploadFileContent.mockResolvedValueOnce(undefined);
    mockDbService.saveSignatureReference.mockRejectedValueOnce(
      new Error("Error saving record on table")
    );

    await expect(
      sqsMessageHandler(
        mockMessage,
        mockFileManager,
        mockDbService,
        mockSafeStorageService
      )
    ).rejects.toThrow("Error saving record on table");
  });

  it("throws when decodeSQSEventMessage fails", async () => {
    vi.spyOn(decodeModule, "decodeSQSEventMessage").mockImplementation(() => {
      throw new Error("Failed to decode SQS S3 event message");
    });

    await expect(
      sqsMessageHandler(
        mockMessage,
        mockFileManager,
        mockDbService,
        mockSafeStorageService
      )
    ).rejects.toThrow("Failed to decode SQS S3 event message");
  });
});
