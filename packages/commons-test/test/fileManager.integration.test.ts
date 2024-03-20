/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { StartedTestContainer } from "testcontainers";
import {
  FileManager,
  FileManagerConfig,
  LoggerConfig,
  fileManagerCopyError,
  fileManagerDeleteError,
  fileManagerListFilesError,
  fileManagerStoreBytesError,
  initFileManager,
} from "pagopa-interop-commons";
import { TEST_MINIO_PORT, minioContainer } from "../src/index.js";

describe("FileManager tests", async () => {
  process.env.AWS_CONFIG_FILE = "aws.config.local";

  const config: FileManagerConfig & LoggerConfig = {
    s3CustomServer: true,
    s3ServerHost: "http://127.0.0.1",
    s3ServerPort: 9000,
    logLevel: "info",
  };

  const s3Bucket = "interop-be-test-bucket";

  let fileManager: FileManager;
  let startedMinioContainer: StartedTestContainer;

  beforeAll(async () => {
    startedMinioContainer = await minioContainer({ s3Bucket }).start();

    config.s3ServerPort = startedMinioContainer.getMappedPort(TEST_MINIO_PORT);
    fileManager = initFileManager(config);
  });

  afterEach(async () => {
    const files = await fileManager.listFiles(s3Bucket);
    await Promise.all(files.map((file) => fileManager.delete(s3Bucket, file)));
  });

  afterAll(async () => {
    await startedMinioContainer.stop();
  });

  describe("FileManager storeBytes", () => {
    it("should store a file in the bucket", async () => {
      const result = await fileManager.storeBytes(
        s3Bucket,
        "test",
        "test",
        "test",
        Buffer.from("test")
      );
      expect(result).toBe("test/test/test");

      const files = await fileManager.listFiles(s3Bucket);
      expect(files).toContain("test/test/test");
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.storeBytes(
          "invalid bucket",
          "test",
          "test",
          "test",
          Buffer.from("test")
        )
      ).rejects.toThrowError(
        fileManagerStoreBytesError(
          "test/test/test",
          "invalid bucket",
          new Error("The specified bucket is not valid.")
        )
      );
    });
  });

  describe("FileManager listFiles", () => {
    it("should list all files in the bucket", async () => {
      await fileManager.storeBytes(
        s3Bucket,
        "test",
        "test",
        "test1",
        Buffer.from("test1")
      );
      await fileManager.storeBytes(
        s3Bucket,
        "test",
        "test",
        "test2",
        Buffer.from("test2")
      );

      const files = await fileManager.listFiles(s3Bucket);
      expect(files.length).toBe(2);
      expect(files).toContain("test/test/test1");
      expect(files).toContain("test/test/test2");
    });

    it("should return an empty array if no files are present in the bucket", async () => {
      const files = await fileManager.listFiles(s3Bucket);
      expect(files).toEqual([]);
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.listFiles("invalid bucket")
      ).rejects.toThrowError(
        fileManagerListFilesError(
          "invalid bucket",
          new Error("The specified bucket is not valid.")
        )
      );
    });
  });

  describe("FileManager delete", () => {
    it("should remove a file from the bucket", async () => {
      await fileManager.storeBytes(
        s3Bucket,
        "test",
        "test",
        "test",
        Buffer.from("test")
      );
      const listBeforeDelete = await fileManager.listFiles(s3Bucket);
      expect(listBeforeDelete).toContain("test/test/test");

      await fileManager.delete(s3Bucket, "test/test/test");
      const listAfterDelete = await fileManager.listFiles(s3Bucket);
      expect(listAfterDelete).not.toContain("test/test/test");
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.delete("invalid bucket", "test/test/test")
      ).rejects.toThrowError(
        fileManagerDeleteError(
          "test/test/test",
          "invalid bucket",
          new Error("The specified bucket is not valid.")
        )
      );
    });
  });

  describe("FileManager copy", () => {
    it("should copy a file in the bucket", async () => {
      await fileManager.storeBytes(
        s3Bucket,
        "test",
        "test",
        "test",
        Buffer.from("test")
      );

      const copyResult = await fileManager.copy(
        s3Bucket,
        "test/test/test",
        "test",
        "test",
        "testCopy"
      );

      expect(copyResult).toBe("test/test/testCopy");
      const files = await fileManager.listFiles(s3Bucket);
      expect(files.length).toBe(2);
      expect(files).toContain("test/test/test");
      expect(files).toContain("test/test/testCopy");
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.copy(
          "invalid bucket",
          "test/test/test",
          "test",
          "test",
          "testCopy"
        )
      ).rejects.toThrowError(
        fileManagerCopyError(
          "test/test/test",
          "test/test/testCopy",
          "invalid bucket",
          new Error("The specified bucket is not valid.")
        )
      );
    });

    it("should fail if the file to copy does not exist", async () => {
      await expect(
        fileManager.copy(s3Bucket, "test/test/test", "test", "test", "testCopy")
      ).rejects.toThrowError(
        fileManagerCopyError(
          "test/test/test",
          "test/test/testCopy",
          s3Bucket,
          new Error("The specified key does not exist.")
        )
      );
    });
  });
});
