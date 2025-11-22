import axios, { AxiosInstance } from "axios";

import { genericInternalError } from "pagopa-interop-models";
import {
  FileCreationRequest,
  FileCreationResponse,
  FileDownloadResponse,
} from "../models/safeStorageServiceSchema.js";
import { SafeStorageApiConfig } from "../config/config.js";
import { Logger } from "../../logging/index.js";

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
      request: FileCreationRequest,
      logger: Logger
    ): Promise<FileCreationResponse> {
      try {
        logger.info(`Creating file on safe storage with id`);
        const response = await apiClient.post(
          "/safe-storage/v1/files",
          request,
          {
            headers: {
              "x-pagopa-safestorage-cx-id": config.safeStorageClientId,
              "x-checksum": "SHA-256",
              "x-checksum-value": request.checksumValue,
            },
          }
        );
        return response.data;
      } catch (error) {
        throw genericInternalError(
          `Error creating file on safe storage, details: ${error}`
        );
      }
    },

    // eslint-disable-next-line max-params
    async uploadFileContent(
      uploadUrl: string,
      fileContent: Buffer,
      contentType: string,
      secret: string,
      checksumValue: string,
      logger: Logger
    ): Promise<void> {
      logger.info(`Uploading file content on safe storage`);
      try {
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
      } catch (error) {
        throw genericInternalError(
          `Error uploading file content on safe storage, details: ${error}`
        );
      }
    },

    async getFile(
      fileKey: string,
      metadataOnly = false,
      logger: Logger
    ): Promise<FileDownloadResponse> {
      try {
        logger.info(`Getting file on safe storage with key ${fileKey}`);
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
      } catch (error) {
        throw genericInternalError(
          `Error getting file content on safe storage, details: ${error}`
        );
      }
    },

    async downloadFileContent(
      downloadUrl: string,
      logger: Logger
    ): Promise<Buffer> {
      try {
        logger.info(`Downloading file on safe storage with url ${downloadUrl}`);
        const response = await axios.get(downloadUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
        });
        return Buffer.from(response.data);
      } catch (error) {
        throw genericInternalError(
          `Error downloading file content with url ${downloadUrl} on safe storage, details: ${error}`
        );
      }
    },
  };
}

export type SafeStorageService = ReturnType<typeof createSafeStorageApiClient>;
