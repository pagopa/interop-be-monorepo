import axios, { AxiosInstance } from "axios";

import {
  FileCreationRequest,
  FileCreationResponse,
  FileDownloadResponse,
} from "../models/safeStorageServiceSchema.js";
import { SafeStorageApiConfig } from "../config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createSafeStorageApiClient(config: SafeStorageApiConfig) {
  const apiClient: AxiosInstance = axios.create({
    baseURL: config.safeStorageBaseUrl,
    headers: {
      "x-api-key": config.safeStorageApiKey,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  return {
    async createFile(
      request: FileCreationRequest
    ): Promise<FileCreationResponse> {
      const response = await apiClient.post("/safe-storage/v1/files", request, {
        headers: {
          "x-pagopa-safestorage-cx-id": config.safeStorageClientId,
          "x-checksum": "SHA-256",
          "x-checksum-value": request.checksumValue,
        },
      });
      return response.data;
    },

    async uploadFileContent(
      uploadUrl: string,
      fileContent: Buffer,
      contentType: string,
      secret: string,
      checksumValue: string
    ): Promise<void> {
      await axios.put(uploadUrl, fileContent, {
        headers: {
          "Content-Type": contentType,
          "x-amz-checksum-sha256": checksumValue,
          "x-amz-meta-secret": secret,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000,
      });
    },

    async getFile(
      fileKey: string,
      metadataOnly = false
    ): Promise<FileDownloadResponse> {
      const response = await apiClient.get(
        `/safe-storage/v1/files/${fileKey}`,
        {
          headers: {
            "x-pagopa-safestorage-cx-id": config.safeStorageClientId,
          },
          params: {
            metadataOnly: metadataOnly ? "true" : "false",
          },
        }
      );
      return response.data;
    },

    async downloadFileContent(downloadUrl: string): Promise<Buffer> {
      const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
      });
      return Buffer.from(response.data);
    },
  };
}

export type SafeStorageService = ReturnType<typeof createSafeStorageApiClient>;
