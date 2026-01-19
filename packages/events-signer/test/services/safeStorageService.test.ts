/* eslint-disable functional/no-let */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import axios from "axios";
import { createSafeStorageApiClient } from "pagopa-interop-commons";
import { config } from "../../src/config/config.js";

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  isDebugEnabled: vi.fn(),
};

vi.mock("axios");
const mockedAxios = axios as unknown as {
  create: Mock;
  put: Mock;
  get: Mock;
};

describe("SafeStorageApiClient", () => {
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

  it("createFile should POST and return presigned URL info", async () => {
    const mockResponseData = {
      uploadMethod: "PUT",
      uploadUrl: "https://presigned-upload-url.com",
      secret: "mock-secret",
      key: "mock/key/file.pdf",
    };

    mockAxiosInstance.post.mockResolvedValue({ data: mockResponseData });

    const client = createSafeStorageApiClient(config);
    const result = await client.createFile(
      {
        contentType: "application/pdf",
        documentType: "PN_NOTIFICATION_ATTACHMENTS",
        status: "PRELOADED",
        checksumValue: "mock-checksum",
      },
      mockLogger
    );

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      "/safe-storage/v1/files",
      {
        contentType: "application/pdf",
        documentType: "PN_NOTIFICATION_ATTACHMENTS",
        status: "PRELOADED",
        checksumValue: "mock-checksum",
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-pagopa-safestorage-cx-id": config.safeStorageClientId,
          "x-checksum": "SHA-256",
          "x-checksum-value": "mock-checksum",
        }),
      })
    );
    expect(result).toEqual(mockResponseData);
  });

  it("uploadFileContent should PUT file to presigned URL", async () => {
    const client = createSafeStorageApiClient(config);

    const putSpy = vi.spyOn(axios, "put").mockResolvedValue({ status: 200 });

    const buffer = Buffer.from("test-pdf-content");
    await client.uploadFileContent(
      "https://upload.example.com/file",
      buffer,
      "application/pdf",
      "mock-secret",
      "mock-checksum",
      mockLogger
    );

    expect(putSpy).toHaveBeenCalledWith(
      "https://upload.example.com/file",
      buffer,
      expect.objectContaining({
        headers: {
          "Content-Type": "application/pdf",
          "x-amz-meta-secret": "mock-secret",
          "x-amz-checksum-sha256": "mock-checksum",
        },
      })
    );
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

    const client = createSafeStorageApiClient(config);
    const result = await client.getFile("mock/key.pdf", false, mockLogger);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/safe-storage/v1/files/mock/key.pdf",
      expect.objectContaining({
        headers: {
          "x-pagopa-safestorage-cx-id": config.safeStorageClientId,
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

    const client = createSafeStorageApiClient(config);
    const result = await client.downloadFileContent(
      "https://download.mock/file",
      "s3key",
      mockLogger
    );

    expect(getSpy).toHaveBeenCalledWith("https://download.mock/file", {
      responseType: "arraybuffer",
      timeout: 60000,
    });
    expect(result).toEqual(buffer);
  });
});
