import * as dotenvFlow from "dotenv-flow";
import { z } from "zod";
import {
  config as commonsConfig,
  Config as CommonConfig,
} from "pagopa-interop-commons";
import { APIEndpoint } from "../model/apiEndpoint.js";

dotenvFlow.config();

const FileManagerConfig = z
  .discriminatedUnion("MOCK_FILE_MANAGER", [
    z.object({
      MOCK_FILE_MANAGER: z.literal("true"),
    }),
    z.object({
      MOCK_FILE_MANAGER: z.literal("false"),
      S3_ACCESS_KEY_ID: z.string(),
      S3_SECRET_ACCESS_KEY: z.string(),
      S3_REGION: z.string(),
      S3_BUCKET_NAME: z.string(),
      ESERVICE_DOCS_PATH: z.string(),
    }),
    z.object({
      MOCK_FILE_MANAGER: z.undefined(),
      S3_ACCESS_KEY_ID: z.string(),
      S3_SECRET_ACCESS_KEY: z.string(),
      S3_REGION: z.string(),
      S3_BUCKET_NAME: z.string(),
      ESERVICE_DOCS_PATH: z.string(),
    }),
  ])
  .transform((c) =>
    c.MOCK_FILE_MANAGER === "false"
      ? {
          mockFileManager: false as const,
          s3AccessKeyId: c.S3_ACCESS_KEY_ID,
          s3SecretAccessKey: c.S3_SECRET_ACCESS_KEY,
          s3Region: c.S3_REGION,
          s3BucketName: c.S3_BUCKET_NAME,
          eserviceDocsPath: c.ESERVICE_DOCS_PATH,
        }
      : {
          mockFileManager: true as const,
        }
  );

export type FileManagerConfig = z.infer<typeof FileManagerConfig>;
const RequiredConfig = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
    MOCK_FILE_MANAGER: z.coerce.boolean().default(false),
    EVENTSTORE_DB_HOST: z.string(),
    EVENTSTORE_DB_NAME: z.string(),
    EVENTSTORE_DB_USERNAME: z.string(),
    EVENTSTORE_DB_PASSWORD: z.string(),
    EVENTSTORE_DB_PORT: z.coerce.number().min(1001),
    READMODEL_DB_HOST: z.string(),
    READMODEL_DB_NAME: z.string(),
    READMODEL_DB_USERNAME: z.string(),
    READMODEL_DB_PASSWORD: z.string(),
    READMODEL_DB_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    host: c.HOST,
    port: c.PORT,
    mockFileManager: c.MOCK_FILE_MANAGER,
    eventStoreDbHost: c.EVENTSTORE_DB_HOST,
    eventStoreDbName: c.EVENTSTORE_DB_NAME,
    eventStoreDbUsername: c.EVENTSTORE_DB_USERNAME,
    eventStoreDbPassword: c.EVENTSTORE_DB_PASSWORD,
    eventStoreDbPort: c.EVENTSTORE_DB_PORT,
    readModelDbHost: c.READMODEL_DB_HOST,
    readModelDbName: c.READMODEL_DB_NAME,
    readModelDbUsername: c.READMODEL_DB_USERNAME,
    readModelDbPassword: c.READMODEL_DB_PASSWORD,
    readModelDbPort: c.READMODEL_DB_PORT,
  }));

export const Config = RequiredConfig.and(FileManagerConfig);
export type Config = z.infer<typeof Config>;

export const config: Config & CommonConfig = {
  ...commonsConfig,
  ...Config.parse(process.env),
};
