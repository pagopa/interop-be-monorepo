import { z } from "zod";

const S3CustomServerConfig = z
  .discriminatedUnion("S3_CUSTOM_SERVER", [
    z.object({
      S3_CUSTOM_SERVER: z.literal("true"),
      S3_SERVER_HOST: z.string(),
      S3_SERVER_PORT: z.coerce.number().min(1001),
    }),
    z.object({
      S3_CUSTOM_SERVER: z.literal("false"),
    }),
  ])
  .transform((c) =>
    c.S3_CUSTOM_SERVER === "true"
      ? {
          s3CustomServer: true as const,
          s3ServerHost: c.S3_SERVER_HOST,
          s3ServerPort: c.S3_SERVER_PORT,
        }
      : {
          s3CustomServer: false as const,
        }
  );

export const FileManagerConfig = S3CustomServerConfig;
export type FileManagerConfig = z.infer<typeof FileManagerConfig>;
