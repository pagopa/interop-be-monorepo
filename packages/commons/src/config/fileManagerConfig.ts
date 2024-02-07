import { z } from "zod";

const LocalMinioConfig = z
  .discriminatedUnion("S3_LOCAL_MINIO", [
    z.object({
      S3_LOCAL_MINIO: z.literal("true"),
      S3_LOCAL_MINIO_HOST: z.string(),
      S3_LOCAL_MINIO_PORT: z.coerce.number().min(1001),
    }),
    z.object({
      S3_LOCAL_MINIO: z.literal("false"),
    }),
  ])
  .transform((c) =>
    c.S3_LOCAL_MINIO === "true"
      ? {
          s3LocalMinio: true as const,
          s3LocalMinioHost: c.S3_LOCAL_MINIO_HOST,
          s3LocalMinioPort: c.S3_LOCAL_MINIO_PORT,
        }
      : {
          s3LocalMinio: false as const,
        }
  );

const S3Config = z
  .object({
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    S3_REGION: z.string(),
  })
  .transform((c) => ({
    s3AccessKeyId: c.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: c.S3_SECRET_ACCESS_KEY,
    s3Region: c.S3_REGION,
  }));

export const FileManagerConfig = z.intersection(LocalMinioConfig, S3Config);
export type FileManagerConfig = z.infer<typeof FileManagerConfig>;
