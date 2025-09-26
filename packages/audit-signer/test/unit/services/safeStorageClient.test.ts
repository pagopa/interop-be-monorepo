import "../setup.js";
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import axios from "axios";
import { createSafeStorageApiClient } from "../../../src/services/safeStorageClient.js";
import { safeStorageApiConfig } from "../../../src/config/config.js";

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

    const client = createSafeStorageApiClient(safeStorageApiConfig);
    const result = await client.createFile({
      contentType: "application/pdf",
      documentType: "PN_NOTIFICATION_ATTACHMENTS",
      status: "PRELOADED",
      checksumValue: "mock-checksum",
    });

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
          "x-pagopa-safestorage-cx-id":
            safeStorageApiConfig.safeStorageClientId,
          "x-checksum": "SHA-256",
          "x-checksum-value": "mock-checksum",
        }),
      })
    );
    expect(result).toEqual(mockResponseData);
  });

  it("uploadFileContent should PUT file to presigned URL", async () => {
    const client = createSafeStorageApiClient(safeStorageApiConfig);

    const putSpy = vi.spyOn(axios, "put").mockResolvedValue({ status: 200 });

    const buffer = Buffer.from("test-pdf-content");
    await client.uploadFileContent(
      "https://upload.example.com/file",
      buffer,
      "application/pdf",
      "mock-secret",
      "mock-checksum"
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
});
