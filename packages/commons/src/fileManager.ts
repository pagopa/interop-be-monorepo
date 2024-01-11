import {
  CopyObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { FileManagerConfig } from "./config/fileManagerConfig.js";
import { logger } from "./index.js";

export type FileManager = {
  deleteFile: (container: string, path: string) => Promise<void>;
  copy: (
    container: string,
    path: string,
    filePathToCopy: string,
    documentId: string,
    fileName: string
  ) => Promise<string>;
  storeBytes: (
    documentId: string,
    documentName: string,
    byteArray: Uint8Array
  ) => Promise<string>;
};

const mockFileManager: FileManager = {
  deleteFile: async (container: string, path: string): Promise<void> => {
    logger.info(`Deleting file ${path} from container ${container}`);

    return Promise.resolve();
  },

  copy: async (
    container: string,
    _path: string,
    filePathToCopy: string,
    _documentId: string,
    _fileName: string
  ): Promise<string> => {
    logger.info(
      `Mock Copying file ${filePathToCopy} from container ${container}`
    );
    return Promise.resolve("");
  },
  storeBytes: async (
    _documentId: string,
    _documentName: string,
    _byteArray: Uint8Array
  ): Promise<string> => {
    logger.info(`Mock Storing bytes`);
    return Promise.resolve("mock/path/to/file");
  },
};

export function initFileManager(config: FileManagerConfig): FileManager {
  if (config.mockFileManager) {
    return mockFileManager;
  } else {
    const { s3AccessKeyId, s3SecretAccessKey, s3Region } = config;

    const client = new S3Client({
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
      region: s3Region,
    });

    const buildS3Key = (
      path: string,
      resourceId: string,
      fileName: string
    ): string => `${path}/${resourceId}/${fileName}`;

    return {
      deleteFile: async (container: string, path: string): Promise<void> => {
        await client.send(
          new DeleteObjectCommand({ Bucket: container, Key: path })
        );
      },
      copy: async (
        container: string,
        path: string,
        filePathToCopy: string,
        documentId: string,
        fileName: string
      ): Promise<string> => {
        logger.info(`Copying file ${filePathToCopy}`);

        const s3Key = buildS3Key(path, documentId, fileName);

        await client.send(
          new CopyObjectCommand({
            Bucket: container,
            CopySource: `${container}/${filePathToCopy}`,
            Key: s3Key,
          })
        );
        return Promise.resolve(s3Key);
      },
      storeBytes: async (
        _documentId: string,
        _documentName: string,
        _byteArray: Uint8Array
      ): Promise<string> => {
        logger.info(`Mock Storing bytes`);
        return Promise.resolve("mock/path/to/file");
      },
    };
  }
}
