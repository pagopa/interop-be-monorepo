import axios from "axios";
import { FileManager, Logger } from "pagopa-interop-commons";
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadCSV } from "../src/service/fileDownloader.js";

vi.mock("axios");

const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  isDebugEnabled: vi.fn(),
};

const mockFileManager: FileManager = {
  get: vi.fn(),
  delete: vi.fn(),
  copy: vi.fn(),
  storeBytes: vi.fn(),
  storeBytesByKey: vi.fn(),
  listFiles: vi.fn(),
  generateGetPresignedUrl: vi.fn(),
  generatePutPresignedUrl: vi.fn(),
  resumeOrStoreBytes: vi.fn(),
};

const mockRedirectResponse = {
  headers: {},
};

describe("downloadCSV", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should throw a descriptive error when the content-disposition header is missing", async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce(mockRedirectResponse)
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: Buffer.from("irrelevant"),
      });

    await expect(
      downloadCSV(
        "http://ivass-source.url",
        mockFileManager,
        "bucket",
        mockLogger
      )
    ).rejects.toThrow(
      /Unexpected response from IVASS while downloading the file/
    );

    expect(mockFileManager.storeBytesByKey).not.toHaveBeenCalled();
  });

  it("should throw a descriptive error when the content-disposition header does not contain a filename", async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce(mockRedirectResponse)
      .mockResolvedValueOnce({
        status: 200,
        headers: { "content-disposition": "attachment" },
        data: Buffer.from("irrelevant"),
      });

    await expect(
      downloadCSV(
        "http://ivass-source.url",
        mockFileManager,
        "bucket",
        mockLogger
      )
    ).rejects.toThrow(
      /Unexpected response from IVASS while downloading the file/
    );

    expect(mockFileManager.storeBytesByKey).not.toHaveBeenCalled();
  });
});
