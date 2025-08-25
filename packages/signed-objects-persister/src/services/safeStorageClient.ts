import axios, { AxiosInstance } from "axios";

import { FileDownloadResponse } from "../models/fileDownloadResponse.js";
import { SafeStorageApiConfig } from "../config/config.js";

interface SafeStorageApiClient {
  getFile: (
    fileKey: string,
    metadataOnly?: boolean
  ) => Promise<FileDownloadResponse>;
  downloadFileContent: (downloadUrl: string) => Promise<Buffer>;
}

export function createSafeStorageApiClient(
  config: SafeStorageApiConfig
): SafeStorageApiClient {
  const apiClient: AxiosInstance = axios.create({
    baseURL: config.safeStorageBaseUrl,
    headers: {
      "x-api-key": config.safeStorageApiKey,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  return {
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
