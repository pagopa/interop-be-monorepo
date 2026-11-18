import {
  deleteFiles,
  FileManager,
  genericLogger,
} from "pagopa-interop-commons";
import { setImmediate } from "timers/promises";
import { describe, expect, it, vi } from "vitest";

function setup() {
  const files = new Map([
    ["documents/first.pdf", "first document"],
    ["documents/second.pdf", "second document"],
  ]);
  const fileManager = {
    delete: vi.fn<FileManager["delete"]>(async (_bucket, path) => {
      await setImmediate();
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

describe("deleteFiles", () => {
  it("waits for all files to be deleted and removes duplicate paths only once", async () => {
    const { files, fileManager, options } = setup();

    await expect(
      deleteFiles({
        ...options,
        paths: [...options.paths, options.paths[0]],
      })
    ).resolves.toBeUndefined();

    expect(files.size).toBe(0);
    expect(fileManager.delete).toHaveBeenCalledTimes(2);
  });

  it("logs a deletion failure and completes the remaining deletions without rejecting", async () => {
    const { files, fileManager, options } = setup();
    const error = new Error("Delete failed");
    fileManager.delete.mockRejectedValueOnce(error);
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(deleteFiles(options)).resolves.toBeUndefined();

    expect([...files.entries()]).toEqual([
      ["documents/first.pdf", "first document"],
    ]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("s3://documents/documents/first.pdf")
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(error.message)
    );
  });

  it("reports every failure without rejecting when all deletions fail", async () => {
    const { files, fileManager, options } = setup();
    fileManager.delete.mockRejectedValue(new Error("Storage unavailable"));
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(deleteFiles(options)).resolves.toBeUndefined();

    expect(files.size).toBe(2);
    for (const path of options.paths) {
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(`s3://${options.bucket}/${path}`)
      );
    }
  });
});
