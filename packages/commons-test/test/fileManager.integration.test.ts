/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import {
  fileManagerCopyError,
  fileManagerGetError,
  genericLogger,
  streamToString,
} from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";

import { fileManager, s3Bucket } from "./utils.js";

describe("FileManager tests", async () => {
  describe("FileManager storeBytes", () => {
    it("should store a file in the bucket", async () => {
      const result = await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test",
          content: Buffer.from("test"),
        },
        genericLogger
      );
      expect(result).toBe("test/test/test");

      const files = await fileManager.listFiles(s3Bucket, genericLogger);
      expect(files).toContain("test/test/test");
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.storeBytes(
          {
            bucket: "invalid bucket",
            path: "test",
            resourceId: "test",
            name: "test",
            content: Buffer.from("test"),
          },
          genericLogger
        )
      ).rejects.toThrowError(
        "Error storing file test/test/test in bucket invalid bucket:"
      );
    });
  });

  describe("FileManager get", () => {
    it("should get a file in the bucket", async () => {
      await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test1",
          content: Buffer.from("test1"),
        },
        genericLogger
      );

      const fileStream = await fileManager.get(
        s3Bucket,
        "test/test/test1",
        genericLogger
      );

      const fileContent = streamToString(fileStream);

      expect(fileContent).toContain("test1");
    });

    it("should throw if the file is not present in the bucket", async () => {
      await expect(
        fileManager.get(s3Bucket, "test", genericLogger)
      ).rejects.toThrowError(
        fileManagerGetError(
          s3Bucket,
          "test",
          new Error("The specified key does not exist.")
        )
      );
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.get("invalid bucket", "test", genericLogger)
      ).rejects.toThrowError(
        "Error getting file test in bucket invalid bucket:"
      );
    });
  });

  describe("FileManager listFiles", () => {
    it("should list all files in the bucket", async () => {
      await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test1",
          content: Buffer.from("test1"),
        },
        genericLogger
      );
      await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test2",
          content: Buffer.from("test2"),
        },
        genericLogger
      );

      const files = await fileManager.listFiles(s3Bucket, genericLogger);
      expect(files.length).toBe(2);
      expect(files).toContain("test/test/test1");
      expect(files).toContain("test/test/test2");
    });

    it("should return an empty array if no files are present in the bucket", async () => {
      const files = await fileManager.listFiles(s3Bucket, genericLogger);
      expect(files).toEqual([]);
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.listFiles("invalid bucket", genericLogger)
      ).rejects.toThrowError("Error listing files in bucket invalid bucket:");
    });
  });

  describe("FileManager delete", () => {
    it("should remove a file from the bucket", async () => {
      await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test",
          content: Buffer.from("test"),
        },
        genericLogger
      );
      const listBeforeDelete = await fileManager.listFiles(
        s3Bucket,
        genericLogger
      );
      expect(listBeforeDelete).toContain("test/test/test");

      await fileManager.delete(s3Bucket, "test/test/test", genericLogger);
      const listAfterDelete = await fileManager.listFiles(
        s3Bucket,
        genericLogger
      );
      expect(listAfterDelete).not.toContain("test/test/test");
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.delete("invalid bucket", "test/test/test", genericLogger)
      ).rejects.toThrowError(
        "Error deleting file test/test/test from bucket invalid bucket:"
      );
    });
  });

  describe("FileManager copy", () => {
    it("should copy a file in the bucket", async () => {
      await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test",
          content: Buffer.from("test"),
        },
        genericLogger
      );

      const copyResult = await fileManager.copy(
        s3Bucket,
        "test/test/test",
        "test",
        "test",
        "testCopy",
        genericLogger
      );

      expect(copyResult).toBe("test/test/testCopy");
      const files = await fileManager.listFiles(s3Bucket, genericLogger);
      expect(files.length).toBe(2);
      expect(files).toContain("test/test/test");
      expect(files).toContain("test/test/testCopy");
    });

    it("should copy a file in the bucket (source file contains a special character in the file name)", async () => {
      await fileManager.storeBytes(
        {
          bucket: s3Bucket,
          path: "test",
          resourceId: "test",
          name: "test-à",
          content: Buffer.from("test"),
        },
        genericLogger
      );

      const copyResult = await fileManager.copy(
        s3Bucket,
        "test/test/test-à",
        "test",
        "test",
        "testCopy-à",
        genericLogger
      );

      expect(copyResult).toBe("test/test/testCopy-à");
      const files = await fileManager.listFiles(s3Bucket, genericLogger);
      expect(files.length).toBe(2);
      expect(files).toContain("test/test/test-à");
      expect(files).toContain("test/test/testCopy-à");
    });

    it("should fail if the bucket does not exist", async () => {
      await expect(
        fileManager.copy(
          "invalid bucket",
          "test/test/test",
          "test",
          "test",
          "testCopy",
          genericLogger
        )
      ).rejects.toThrowError(
        "Error copying file test/test/test to test/test/testCopy in bucket invalid bucket:"
      );
    });

    it("should fail if the file to copy does not exist", async () => {
      await expect(
        fileManager.copy(
          s3Bucket,
          "test/test/test",
          "test",
          "test",
          "testCopy",
          genericLogger
        )
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
