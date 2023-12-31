import { z } from "zod";

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
    }),
    z.object({
      MOCK_FILE_MANAGER: z.undefined(),
      S3_ACCESS_KEY_ID: z.string(),
      S3_SECRET_ACCESS_KEY: z.string(),
      S3_REGION: z.string(),
    }),
  ])
  .transform((c) =>
    c.MOCK_FILE_MANAGER === "false"
      ? {
          mockFileManager: false as const,
          s3AccessKeyId: c.S3_ACCESS_KEY_ID,
          s3SecretAccessKey: c.S3_SECRET_ACCESS_KEY,
          s3Region: c.S3_REGION,
        }
      : {
          mockFileManager: true as const,
        }
  );

export type FileManagerConfig = z.infer<typeof FileManagerConfig>;
