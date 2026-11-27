import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import {
  FileManagerConfig,
  LoggerConfig,
  genericLogger,
  initFileManager,
} from "pagopa-interop-commons";
import { beforeEach, describe, expect, it } from "vitest";

const s3Mock = mockClient(S3Client);

const config: FileManagerConfig & LoggerConfig = {
  s3CustomServer: false,
  logLevel: "info",
};

const s3File = {
  bucket: "test-bucket",
  path: "test/path",
  name: "document_signed.pdf",
  content: Buffer.from("content"),
};

const expectedKey = `${s3File.path}/${s3File.name}`;

function s3Error(name: string, httpStatusCode: number): S3ServiceException {
  return new S3ServiceException({
    name,
    message: name,
    $fault: "client",
    $metadata: { httpStatusCode },
  });
}

const notFound = (): S3ServiceException => s3Error("NotFound", 404);
const conflict = (): S3ServiceException => s3Error("Conflict", 409);

describe("resumeOrStoreBytes", () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it("should resume the existing file without storing it again", async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    const fileManager = initFileManager(config);
    const key = await fileManager.resumeOrStoreBytes(s3File, genericLogger);

    expect(key).toBe(expectedKey);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it("should store the file when it does not exist yet", async () => {
    s3Mock.on(HeadObjectCommand).rejects(notFound());
    s3Mock.on(PutObjectCommand).resolves({});

    const fileManager = initFileManager(config);
    const key = await fileManager.resumeOrStoreBytes(s3File, genericLogger);

    expect(key).toBe(expectedKey);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
  });

  it("should resume the file when the store fails and the file exists", async () => {
    s3Mock.on(HeadObjectCommand).rejectsOnce(notFound()).resolves({});
    s3Mock.on(PutObjectCommand).rejects(conflict());

    const fileManager = initFileManager(config);
    const key = await fileManager.resumeOrStoreBytes(s3File, genericLogger);

    expect(key).toBe(expectedKey);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
    // The first head check misses the file, the second one finds it.
    expect(s3Mock.commandCalls(HeadObjectCommand)).toHaveLength(2);
  });

  it("should fail with the store error when the file does not exist", async () => {
    s3Mock.on(HeadObjectCommand).rejects(notFound());
    s3Mock.on(PutObjectCommand).rejects(s3Error("AccessDenied", 403));

    const fileManager = initFileManager(config);

    await expect(
      fileManager.resumeOrStoreBytes(s3File, genericLogger)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "fileManagerStoreBytesError",
        detail: expect.stringContaining("AccessDenied"),
      })
    );
    expect(s3Mock.commandCalls(HeadObjectCommand)).toHaveLength(2);
  });

  it("should fail with the store error when the check after the store also fails", async () => {
    s3Mock.on(HeadObjectCommand).rejectsOnce(notFound()).rejects(conflict());
    s3Mock.on(PutObjectCommand).rejects(s3Error("AccessDenied", 403));

    const fileManager = initFileManager(config);

    await expect(
      fileManager.resumeOrStoreBytes(s3File, genericLogger)
    ).rejects.toThrowError(
      expect.objectContaining({ code: "fileManagerStoreBytesError" })
    );
  });

  it("should fail when the head check fails for a reason other than a missing file", async () => {
    s3Mock.on(HeadObjectCommand).rejects(s3Error("AccessDenied", 403));

    const fileManager = initFileManager(config);

    await expect(
      fileManager.resumeOrStoreBytes(s3File, genericLogger)
    ).rejects.toThrowError(
      expect.objectContaining({ code: "fileManagerResumeFileError" })
    );
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it("should build the key with the resource id when it is provided", async () => {
    s3Mock.on(HeadObjectCommand).rejects(notFound());
    s3Mock.on(PutObjectCommand).resolves({});

    const fileManager = initFileManager(config);
    const key = await fileManager.resumeOrStoreBytes(
      { ...s3File, resourceId: "resource-id" },
      genericLogger
    );

    expect(key).toBe(`${s3File.path}/resource-id/${s3File.name}`);
  });
});
