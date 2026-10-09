/* eslint-disable max-params */
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
  S3ClientConfig,
  HeadObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

import { FileManagerConfig } from "../config/fileManagerConfig.js";
import { LoggerConfig } from "../config/loggerConfig.js";
import { Logger } from "../logging/index.js";
import {
  fileManagerCopyError,
  fileManagerDeleteError,
  fileManagerGetError,
  fileManagerResumeFileError,
  fileManagerListFilesError,
  fileManagerStoreBytesError,
} from "./fileManagerErrors.js";

export type FileManager = {
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
  resumeOrStoreBytes: (
    s3File: {
      bucket: string;
      path: string;
      resourceId?: string;
      name: string;
      content: Buffer;
    },
    logger: Logger
  ) => Promise<string>;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
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
          ChecksumSHA256: crypto
            .createHash("sha256")
            .update(fileContent)
            .digest("base64")
            .toString(),
        })
      );
      return key;
    } catch (error) {
      throw fileManagerStoreBytesError(key, bucket, error);
    }
  };

  const fileExists = async (
    bucket: string,
    key: string,
    logger: Logger
  ): Promise<boolean> => {
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === "NotFound") {
        return false;
      }
      // The caller is already handling a store failure, so this check must not
      // replace it with a less accurate error.
      logger.warn(
        `Error checking file s3://${bucket}/${key} after a store failure: ${error}`
      );
      return false;
    }
  };

  const storeBytesFn = async (
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
  };

  return {
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
            CopySource: encodeURI(`${bucket}/${filePathToCopy}`),
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
          new ListObjectsCommand({ Bucket: bucket })
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
    storeBytes: storeBytesFn,
    resumeOrStoreBytes: async (
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
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: s3File.bucket,
            Key: key,
          })
        );
        logger.info(
          `File already exists, resuming s3://${s3File.bucket}/${key}`
        );
        return key;
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === "NotFound") {
          logger.info(
            `File not found, storing new one s3://${s3File.bucket}/${key}`
          );
        } else {
          logger.error(
            `Error checking file s3://${s3File.bucket}/${key}: ${error}`
          );
          throw fileManagerResumeFileError(key, s3File.bucket, error);
        }
      }

      try {
        return await storeBytesFn(s3File, logger);
      } catch (storeError) {
        // The head check above can miss a file that a concurrent writer stores
        // immediately after, and an immutable bucket rejects the overwrite. An
        // existing key is the result this function asks for, so it is a
        // success, as in the head check above.
        if (await fileExists(s3File.bucket, key, logger)) {
          logger.warn(
            `File exists after a failed store, resuming s3://${s3File.bucket}/${key}. Store error: ${storeError}`
          );
          return key;
        }
        throw storeError;
      }
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
