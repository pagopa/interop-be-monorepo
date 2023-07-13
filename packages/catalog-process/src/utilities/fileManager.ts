import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logger } from "pagopa-interop-commons";
import { config } from "./config.js";

export type FileManager = {
  deleteFile: (path: string) => Promise<void>;
};

const mockFileManager: FileManager = {
  deleteFile: async (path: string): Promise<void> => {
    logger.info(`Deleting file ${path}`);

    return Promise.resolve();
  },
};

const s3FileManager = (): FileManager => {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.s3AccessKeyId as string,
      secretAccessKey: config.s3SecretAccessKey as string,
    },
    region: config.s3Region,
  });
  return {
    deleteFile: async (path: string): Promise<void> => {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.s3BucketName, Key: path })
      );
    },
  };
};

function initFileManager(): FileManager {
  return config.mockFileManager ? mockFileManager : s3FileManager();
}

export const fileManager = initFileManager();
