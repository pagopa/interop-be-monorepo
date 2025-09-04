import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import axios from "axios";
import { createSafeStorageApiClient } from "../src/services/safeStorageClient.js";
import { safeStorageConfig } from "../src/config/config.js";

vi.mock("axios");

const mockedAxios = axios as unknown as {
  create: Mock;
  put: Mock;
  get: Mock;
};

describe("SafeStorageApiClient - Unit Tests", () => {
  const mockAxiosInstance = {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };

  beforeEach(() => {
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("getFile should GET file metadata and/or download URL", async () => {
    const mockResponse = {
      key: "mock/key.pdf",
      versionId: "v1",
      contentType: "application/pdf",
      contentLength: 1234,
      checksum: "abc123",
      documentType: "PN_LEGAL_FACTS",
      documentStatus: "SAVED",
      retentionUntil: "2035-12-31T23:59:59Z",
      download: {
        url: "https://download.mock/file.pdf",
      },
    };

    mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

    const client = createSafeStorageApiClient(safeStorageConfig);
    const result = await client.getFile("mock/key.pdf");

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/safe-storage/v1/files/mock/key.pdf",
      expect.objectContaining({
        headers: {
          "x-pagopa-safestorage-cx-id": safeStorageConfig.safeStorageClientId,
        },
        params: { metadataOnly: "false" },
      })
    );

    expect(result).toEqual(mockResponse);
  });

  it("downloadFileContent should GET binary file", async () => {
    const buffer = Buffer.from("mocked binary content");

    const getSpy = vi.spyOn(axios, "get").mockResolvedValue({
      data: buffer,
    });

    const client = createSafeStorageApiClient(safeStorageConfig);
    const result = await client.downloadFileContent(
      "https://download.example.com/file"
    );

    expect(getSpy).toHaveBeenCalledWith("https://download.example.com/file", {
      responseType: "arraybuffer",
      timeout: 60000,
    });
    expect(result).toEqual(buffer);
  });
});
