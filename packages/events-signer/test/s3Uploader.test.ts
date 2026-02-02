import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  FileManager,
  genericLogger,
  initFileManager,
} from "pagopa-interop-commons";
import { uploadPreparedFileToS3 } from "../src/handlers/s3UploaderHandler.js";
import { config as appConfig, config } from "../src/config/config.js";

const fileManager: FileManager = initFileManager(config);

describe("uploadPreparedFileToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully upload a prepared file to S3 and return its details", async () => {
    const mockPreparedFile = {
      fileContentBuffer: Buffer.from("test content"),
      fileName: "test-file.ndjson.gz",
      filePath: "path/to",
      resourceId: "resource-id-123",
    };
    const mockS3Key = "path/to/test-file.ndjson.gz";
    const fileManagerStoreBytesSpy = vi
      .spyOn(fileManager, "storeBytes")
      .mockResolvedValue(mockS3Key);

    const result = await uploadPreparedFileToS3(
      mockPreparedFile,
      fileManager,
      genericLogger,
      appConfig
    );

    expect(fileManagerStoreBytesSpy).toHaveBeenCalledTimes(1);
    expect(fileManagerStoreBytesSpy).toHaveBeenCalledWith(
      {
        bucket: appConfig.s3Bucket,
        path: mockPreparedFile.filePath,
        name: mockPreparedFile.fileName,
        content: mockPreparedFile.fileContentBuffer,
      },
      genericLogger
    );

    expect(result).toEqual({
      fileContentBuffer: mockPreparedFile.fileContentBuffer,
      fileName: "test-file.ndjson.gz",
      path: "path/to",
    });
  });

  it("should throw genericInternalError if fileManager.storeBytes fails", async () => {
    const mockPreparedFile = {
      fileContentBuffer: Buffer.from("test content"),
      fileName: "failing-file.ndjson.gz",
      filePath: "path/to",
    };
    const mockError = new Error("S3 upload failed");
    const fileManagerStoreBytesSpy = vi.spyOn(fileManager, "storeBytes");
    fileManagerStoreBytesSpy.mockRejectedValue(mockError);

    await expect(
      uploadPreparedFileToS3(
        mockPreparedFile,
        fileManager,
        genericLogger,
        appConfig
      )
    ).rejects.toThrow(
      `Failed to store file ${mockPreparedFile.fileName} in S3: ${mockError}`
    );

    expect(fileManagerStoreBytesSpy).toHaveBeenCalledTimes(1);
  });
});
