import {
  CopyObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { logger } from "pagopa-interop-commons";
import { config } from "./config.js";

export type FileManager = {
  deleteFile: (path: string) => Promise<void>;
  copy: (
    filePathToCopy: string,
    documentId: string,
    fileName: string
  ) => Promise<string>;
};

const mockFileManager: FileManager = {
  deleteFile: async (path: string): Promise<void> => {
    logger.info(`Deleting file ${path}`);

    return Promise.resolve();
  },

  copy: async (
    filePathToCopy: string,
    _documentId: string,
    _fileName: string
  ): Promise<string> => {
    logger.info(`Mock Copying file ${filePathToCopy}`);
    return Promise.resolve("");
  },
};

function initFileManager(): FileManager {
  if (config.mockFileManager) {
    return mockFileManager;
  } else {
    const {
      s3AccessKeyId,
      s3SecretAccessKey,
      s3Region,
      s3BucketName,
      eserviceDocsPath,
    } = config;

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
      deleteFile: async (path: string): Promise<void> => {
        await client.send(
          new DeleteObjectCommand({ Bucket: s3BucketName, Key: path })
        );
      },
      copy: async (
        filePathToCopy: string,
        documentId: string,
        fileName: string
      ): Promise<string> => {
        logger.info(`Copying file ${filePathToCopy}`);

        const s3Key = buildS3Key(eserviceDocsPath, documentId, fileName);

        await client.send(
          new CopyObjectCommand({
            CopySource: `${config.s3BucketName}/${filePathToCopy}`,
            Bucket: config.s3BucketName,
            Key: s3Key,
          })
        );
        return Promise.resolve(s3Key);
      },
    };
  }
}

export const fileManager = initFileManager();
