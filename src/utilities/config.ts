import * as dotenvFlow from "dotenv-flow";
import { z } from "zod";
import { APIEndpoint } from "../model/apiEndpoint.js";

dotenvFlow.config();

const Config = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
    POSTGRESQL_URI: z.string(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
    MOCK_FILE_MANAGER: z.coerce.boolean().default(false),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
  })
  .transform((c) => ({
    host: c.HOST,
    port: c.PORT,
    dbURL: c.POSTGRESQL_URI,
    logLevel: c.LOG_LEVEL,
    mockFileManager: c.MOCK_FILE_MANAGER,
    s3AccessKeyId: c.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: c.S3_SECRET_ACCESS_KEY,
    s3Region: c.S3_REGION,
    s3BucketName: c.S3_BUCKET_NAME,
  }))
  .refine((c) =>
    !c.mockFileManager &&
    (c.s3AccessKeyId === undefined ||
      c.s3SecretAccessKey === undefined ||
      c.s3BucketName === undefined ||
      c.s3Region === undefined)
      ? false
      : true
  );

export const config = Config.parse(process.env);
