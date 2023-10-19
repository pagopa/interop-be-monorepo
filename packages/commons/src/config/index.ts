import { z } from "zod";
import { APIEndpoint } from "./../model/apiEndpoint.js";

const JWTConfig = z.preprocess(
  (c) =>
    (c as { SKIP_JWT_VERIFICATION: string | undefined })
      .SKIP_JWT_VERIFICATION === undefined
      ? { ...(c as object), SKIP_JWT_VERIFICATION: "false" }
      : c,

  z
    .discriminatedUnion("SKIP_JWT_VERIFICATION", [
      z.object({
        SKIP_JWT_VERIFICATION: z.literal("true"),
      }),
      z.object({
        SKIP_JWT_VERIFICATION: z.literal("false"),
        WELL_KNOWN_URLS: z
          .string()
          .transform((s) => s.split(","))
          .pipe(z.array(APIEndpoint)),
      }),
    ])
    .transform((c) =>
      c.SKIP_JWT_VERIFICATION === "false"
        ? {
            skipJWTVerification: false as const,
            wellKnownUrls: c.WELL_KNOWN_URLS,
          }
        : {
            skipJWTVerification: true as const,
          }
    )
);
type JWTConfig = z.infer<typeof JWTConfig>;

export const FileManagerConfig = z
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
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
  }));

const Config = RequiredConfig.and(JWTConfig);

export type Config = z.infer<typeof Config>;

export const HTTPServerConfig = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    host: c.HOST,
    port: c.PORT,
  }));
export type HTTPServerConfig = z.infer<typeof HTTPServerConfig>;

export const config = Config.parse(process.env);
