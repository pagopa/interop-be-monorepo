import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "./config.js";
import { logger } from "./logger.js";

export type FileManager = {
  deleteFile: (path: string) => Promise<void>;
};

const mockFileManager: FileManager = {
  deleteFile: async (path: string): Promise<void> => {
    logger.info(`Deleting file ${path}`);

    return Promise.resolve();
  },
};

const s3FileManager: FileManager = {
  deleteFile: async (path: string): Promise<void> => {
    const client = new S3Client({ region: config.s3Region });

    await client.send(
      new DeleteObjectCommand({ Bucket: config.s3BucketName, Key: path })
    );
  },
};

function initFileManager(): FileManager {
  return config.mockFileManager ? mockFileManager : s3FileManager;
}

export const fileManager = initFileManager();
