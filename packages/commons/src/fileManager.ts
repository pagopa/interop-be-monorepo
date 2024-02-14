import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { FileManagerConfig } from "./config/fileManagerConfig.js";
import { LoggerConfig, logger } from "./index.js";

export type FileManager = {
  delete: (bucket: string, path: string) => Promise<void>;
  copy: (
    bucket: string,
    filePathToCopy: string,
    path: string,
    resourceId: string,
    fileName: string
  ) => Promise<string>;
  storeBytes: (
    bucket: string,
    path: string,
    resourceId: string,
    fileName: string,
    fileContent: Buffer
  ) => Promise<string>;
  listFiles: (bucket: string) => Promise<string[]>;
};

export function initFileManager(
  config: FileManagerConfig & LoggerConfig
): FileManager {
  const s3ClientConfig: S3ClientConfig = {
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
    region: config.s3Region,
    endpoint: config.s3CustomServer
      ? `${config.s3ServerHost}:${config.s3ServerPort}`
      : undefined,
    forcePathStyle: config.s3CustomServer,
    logger: config.logLevel === "debug" ? console : undefined,
  };
  const client = new S3Client(s3ClientConfig);

  const buildS3Key = (
    path: string,
    resourceId: string,
    fileName: string
  ): string => `${path}/${resourceId}/${fileName}`;

  return {
    delete: async (bucket: string, path: string): Promise<void> => {
      logger.info(`Deleting file ${path} from bucket ${bucket}`);
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: path,
        })
      );
    },
    copy: async (
      bucket: string,
      filePathToCopy: string,
      path: string,
      resourceId: string,
      fileName: string
    ): Promise<string> => {
      const key = buildS3Key(path, resourceId, fileName);
      logger.info(`Copying file ${filePathToCopy} to ${key}`);
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${filePathToCopy}`,
          Key: key,
        })
      );
      return key;
    },
    listFiles: async (bucket: string): Promise<string[]> => {
      logger.info(`Listing files in bucket ${bucket}`);
      const response = await client.send(
        new ListObjectsCommand({
          Bucket: bucket,
        })
      );
      return (
        response.Contents?.map((object) => object.Key).filter(
          (key): key is string => key !== undefined
        ) ?? []
      );
    },
    storeBytes: async (
      bucket: string,
      path: string,
      resourceId: string,
      fileName: string,
      fileContent: Buffer
    ): Promise<string> => {
      const key = buildS3Key(path, resourceId, fileName);
      logger.info(`Storing file ${key} in bucket ${bucket}`);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileContent,
        })
      );
      return key;
    },
  };
}
