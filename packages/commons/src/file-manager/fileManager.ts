/* eslint-disable max-params */
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileManagerConfig } from "../config/fileManagerConfig.js";
import { Logger, LoggerConfig } from "../index.js";
import {
  fileManagerCopyError,
  fileManagerDeleteError,
  fileManagerGetError,
  fileManagerListFilesError,
  fileManagerStoreBytesError,
} from "./fileManagerErrors.js";

export type FileManager = {
  buildS3Key: (
    path: string,
    resourceId: string | undefined,
    fileName: string
  ) => string;
  delete: (bucket: string, path: string, logger: Logger) => Promise<void>;
  copy: (
    bucket: string,
    filePathToCopy: string,
    path: string,
    resourceId: string,
    fileName: string,
    logger: Logger
  ) => Promise<string>;
  storeBytes: (
    s3File: {
      bucket: string;
      path: string;
      resourceId?: string;
      name: string;
      content: Buffer;
    },
    logger: Logger
  ) => Promise<string>;
  storeBytesByKey: (
    bucket: string,
    key: string,
    fileContent: Buffer,
    logger: Logger
  ) => Promise<string>;
  get: (bucket: string, path: string, logger: Logger) => Promise<Uint8Array>;
  listFiles: (bucket: string, logger: Logger) => Promise<string[]>;
  generateGetPresignedUrl: (
    bucketName: string,
    path: string,
    fileName: string,
    durationInMinutes: number
  ) => Promise<string>;
  generatePutPresignedUrl: (
    bucketName: string,
    path: string,
    fileName: string,
    durationInMinutes: number
  ) => Promise<string>;
};

export function initFileManager(
  config: FileManagerConfig & LoggerConfig
): FileManager {
  const s3ClientConfig: S3ClientConfig = {
    endpoint: config.s3CustomServer
      ? `${config.s3ServerHost}:${config.s3ServerPort}`
      : undefined,
    forcePathStyle: config.s3CustomServer,
    logger: config.logLevel === "debug" ? console : undefined,
  };
  const client = new S3Client(s3ClientConfig);

  const buildS3Key = (
    path: string,
    resourceId: string | undefined,
    fileName: string
  ): string =>
    [path, resourceId, fileName].filter((s) => s && s.length > 0).join("/");

  const store = async (
    bucket: string,
    key: string,
    fileContent: Buffer
  ): Promise<string> => {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileContent,
        })
      );
      return key;
    } catch (error) {
      throw fileManagerStoreBytesError(key, bucket, error);
    }
  };

  return {
    buildS3Key: (
      path: string,
      resourceId: string | undefined,
      fileName: string
    ): string => buildS3Key(path, resourceId, fileName),
    delete: async (
      bucket: string,
      path: string,
      logger: Logger
    ): Promise<void> => {
      logger.info(`Deleting file ${path} from bucket ${bucket}`);
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: path,
          })
        );
      } catch (error) {
        throw fileManagerDeleteError(path, bucket, error);
      }
    },
    copy: async (
      bucket: string,
      filePathToCopy: string,
      path: string,
      resourceId: string,
      fileName: string,
      logger: Logger
    ): Promise<string> => {
      const key = buildS3Key(path, resourceId, fileName);
      logger.info(
        `Copying file ${filePathToCopy} to ${key} in bucket ${bucket}`
      );
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${filePathToCopy}`,
            Key: key,
          })
        );
        return key;
      } catch (error) {
        throw fileManagerCopyError(filePathToCopy, key, bucket, error);
      }
    },
    get: async (
      bucket: string,
      path: string,
      logger: Logger
    ): Promise<Uint8Array> => {
      logger.info(`Getting file ${path} in bucket ${bucket}`);
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: path,
          })
        );
        const body = response.Body;
        if (!body) {
          throw fileManagerGetError(bucket, path, "File is empty");
        }
        return await body.transformToByteArray();
      } catch (error) {
        throw fileManagerGetError(bucket, path, error);
      }
    },
    listFiles: async (bucket: string, logger: Logger): Promise<string[]> => {
      logger.info(`Listing files in bucket ${bucket}`);
      try {
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
      } catch (error) {
        throw fileManagerListFilesError(bucket, error);
      }
    },
    storeBytesByKey: async (
      bucket: string,
      key: string,
      fileContent: Buffer,
      logger: Logger
    ): Promise<string> => {
      logger.info(`Storing file ${key} in bucket ${bucket}`);
      return store(bucket, key, fileContent);
    },
    storeBytes: async (
      s3File: {
        bucket: string;
        path: string;
        resourceId?: string;
        name: string;
        content: Buffer;
      },
      logger: Logger
    ): Promise<string> => {
      const key = buildS3Key(s3File.path, s3File.resourceId, s3File.name);
      logger.info(`Storing file ${key} in bucket ${s3File.bucket}`);

      return store(s3File.bucket, key, s3File.content);
    },
    generateGetPresignedUrl: async (
      bucketName: string,
      path: string,
      fileName: string,
      durationInMinutes: number
    ): Promise<string> => {
      const key: string = buildS3Key(path, undefined, fileName);
      const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
      return getSignedUrl(client, command, { expiresIn: durationInMinutes });
    },
    generatePutPresignedUrl: async (
      bucketName: string,
      path: string,
      fileName: string,
      durationInMinutes: number
    ): Promise<string> => {
      const key: string = buildS3Key(path, undefined, fileName);
      const command = new PutObjectCommand({ Bucket: bucketName, Key: key });
      return getSignedUrl(client, command, { expiresIn: durationInMinutes });
    },
  };
}
