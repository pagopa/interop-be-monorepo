import {
  CopyObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
  S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import {
  FileManager,
  deleteFilesWithBackup,
  fileManagerCopyError,
  genericLogger,
  initFileManager,
} from "pagopa-interop-commons";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

function setup() {
  const files = new Map([
    ["documents/first.pdf", "first document"],
    ["documents/second.pdf", "second document"],
  ]);
  const fileManager = {
    copy: vi.fn<FileManager["copy"]>(
      async (_bucket, source, path, resourceId, name) => {
        const content = files.get(source);
        const key = [path, resourceId, name].filter(Boolean).join("/");
        if (content === undefined) {
          throw fileManagerCopyError(
            source,
            key,
            "documents",
            new NoSuchKey({ message: "Missing file", $metadata: {} })
          );
        }
        files.set(key, content);
        return key;
      }
    ),
    delete: vi.fn<FileManager["delete"]>(async (_bucket, path) => {
      files.delete(path);
    }),
  };
  const options = {
    fileManager,
    bucket: "documents",
    paths: ["documents/first.pdf", "documents/second.pdf"],
    logger: genericLogger,
  };
  return { files, fileManager, options };
}

describe("file deletion backup S3 boundary", () => {
  const s3Mock = mockClient(S3Client);
  const fileManager = initFileManager({
    s3CustomServer: false,
    logLevel: "info",
  });
  afterEach(() => s3Mock.reset());
  afterAll(() => s3Mock.restore());

  it("encodes reserved characters in copy sources without changing destination keys", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    const source = "documents/document #1?%.pdf";

    await fileManager.copy(
      "documents",
      source,
      "_delete-backups",
      "operation",
      source,
      genericLogger
    );

    expect(
      s3Mock.commandCalls(CopyObjectCommand)[0].args[0].input
    ).toMatchObject({
      CopySource: "documents/documents/document%20%231%3F%25.pdf",
      Key: "_delete-backups/operation/documents/document #1?%.pdf",
    });
  });

  it("recognizes missing originals through the file manager's wrapped S3 error", async () => {
    s3Mock
      .on(CopyObjectCommand)
      .rejects(new NoSuchKey({ message: "Missing file", $metadata: {} }));
    s3Mock.on(DeleteObjectCommand).resolves({});
    vi.spyOn(genericLogger, "warn").mockReturnThis();

    await expect(
      deleteFilesWithBackup(
        {
          fileManager,
          bucket: "documents",
          paths: ["missing.pdf"],
          logger: genericLogger,
        },
        async () => "committed"
      )
    ).resolves.toBe("committed");
  });
});

describe("deleteFilesWithBackup", () => {
  it("keeps S3 backups until the operation succeeds, then removes them", async () => {
    const { files, options } = setup();
    const result = await deleteFilesWithBackup(options, async () => {
      expect(files.has("documents/first.pdf")).toBe(false);
      expect(files.has("documents/second.pdf")).toBe(false);
      expect([...files.values()].sort()).toEqual([
        "first document",
        "second document",
      ]);
      return "committed";
    });

    expect(result).toBe("committed");
    expect(files.size).toBe(0);
  });

  it("restores every deleted file before propagating an operation failure", async () => {
    const { files, options } = setup();
    const error = new Error("Event persistence failed");

    await expect(
      deleteFilesWithBackup(options, async () => {
        throw error;
      })
    ).rejects.toBe(error);

    expect([...files.entries()]).toEqual([
      ["documents/first.pdf", "first document"],
      ["documents/second.pdf", "second document"],
    ]);
  });

  it("does not delete originals or execute the operation if any backup fails", async () => {
    const { files, fileManager, options } = setup();
    const error = new Error("Copy failed");
    const operation = vi.fn(async () => "committed");
    fileManager.copy.mockRejectedValueOnce(error);
    vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(deleteFilesWithBackup(options, operation)).rejects.toBe(error);

    expect(files.get("documents/first.pdf")).toBe("first document");
    expect(files.get("documents/second.pdf")).toBe("second document");
    expect(files.size).toBe(2);
    expect(operation).not.toHaveBeenCalled();
    expect(fileManager.delete).not.toHaveBeenCalledWith(
      options.bucket,
      "documents/first.pdf",
      genericLogger
    );
    expect(fileManager.delete).not.toHaveBeenCalledWith(
      options.bucket,
      "documents/second.pdf",
      genericLogger
    );
  });

  it("waits for all deletes to settle before restoring, including a failed delete with an uncertain outcome", async () => {
    const { files, fileManager, options } = setup();
    const error = new Error("Delete response lost");
    const operation = vi.fn(async () => "committed");
    fileManager.delete.mockImplementation(async (_bucket, path) => {
      if (path === "documents/first.pdf") {
        files.delete(path);
        throw error;
      }
      await Promise.resolve();
      files.delete(path);
    });

    await expect(deleteFilesWithBackup(options, operation)).rejects.toBe(error);

    expect(files.get("documents/first.pdf")).toBe("first document");
    expect(files.get("documents/second.pdf")).toBe("second document");
    expect(files.size).toBe(2);
    expect(operation).not.toHaveBeenCalled();
  });

  it("retains backups and reports both errors if restoration fails, while restoring the other files", async () => {
    const { files, fileManager, options } = setup();
    const operationError = new Error("Event persistence failed");
    const restoreError = new Error("Restore failed");
    const copy = fileManager.copy.getMockImplementation();
    if (!copy) {
      throw new Error("Missing copy implementation");
    }
    fileManager.copy.mockImplementation(async (...args) => {
      if (
        args[1].startsWith("_delete-backups/") &&
        args[4] === "documents/first.pdf"
      ) {
        throw restoreError;
      }
      return copy(...args);
    });
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(
      deleteFilesWithBackup(options, async () => {
        throw operationError;
      })
    ).rejects.toMatchObject({
      cause: operationError,
      errors: [operationError, restoreError],
    });

    expect(files.has("documents/first.pdf")).toBe(false);
    expect(files.get("documents/second.pdf")).toBe("second document");
    expect(
      [...files.keys()].filter((key) => key.startsWith("_delete-backups/"))
    ).toHaveLength(2);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("documents/first.pdf")
    );
  });

  it("does not restore originals or fail a committed operation if backup cleanup fails", async () => {
    const { files, fileManager, options } = setup();
    fileManager.delete.mockImplementation(async (_bucket, path) => {
      if (path.startsWith("_delete-backups/")) {
        throw new Error("Cleanup failed");
      }
      files.delete(path);
    });
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(
      deleteFilesWithBackup(options, async () => "committed")
    ).resolves.toBe("committed");

    expect(files.has("documents/first.pdf")).toBe(false);
    expect(files.has("documents/second.pdf")).toBe(false);
    expect(files.size).toBe(2);
    expect(logError).toHaveBeenCalled();
  });

  it("preserves restored originals and the operation error if backup cleanup fails after rollback", async () => {
    const { files, fileManager, options } = setup();
    const operationError = new Error("Event persistence failed");
    fileManager.delete.mockImplementation(async (_bucket, path) => {
      if (path.startsWith("_delete-backups/")) {
        throw new Error("Cleanup failed");
      }
      files.delete(path);
    });
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(
      deleteFilesWithBackup(options, async () => {
        throw operationError;
      })
    ).rejects.toBe(operationError);

    expect(files.get("documents/first.pdf")).toBe("first document");
    expect(files.get("documents/second.pdf")).toBe("second document");
    const backupPaths = [...files.keys()].filter((path) =>
      path.startsWith("_delete-backups/")
    );
    expect(backupPaths).toHaveLength(2);
    for (const backupPath of backupPaths) {
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(backupPath)
      );
    }
  });

  it("preserves idempotent deletion of missing files without masking other copy errors", async () => {
    const { files, options } = setup();
    files.delete("documents/first.pdf");
    vi.spyOn(genericLogger, "warn").mockReturnThis();

    await expect(
      deleteFilesWithBackup(options, async () => "committed")
    ).resolves.toBe("committed");
    expect(files.size).toBe(0);
  });
});
