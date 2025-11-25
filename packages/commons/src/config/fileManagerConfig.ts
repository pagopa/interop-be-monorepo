import { z } from "zod";

const S3CustomServerConfig = z.preprocess(
  (c) =>
    (c as { S3_CUSTOM_SERVER: string | undefined }).S3_CUSTOM_SERVER ===
    undefined
      ? // eslint-disable-next-line local-rules/no-unsafe-object-spread
        { ...(c as object), S3_CUSTOM_SERVER: "false" }
      : c,

  z
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
    )
);

export const S3Config = z
  .object({ S3_BUCKET: z.string() })
  .transform((c) => ({ s3Bucket: c.S3_BUCKET }));
export type S3Config = z.infer<typeof S3Config>;

export const FileManagerConfig = S3CustomServerConfig;
export type FileManagerConfig = z.infer<typeof FileManagerConfig>;
