import { z } from "zod";

export const AWSConfig = z
  .object({
    AWS_REGION: z.string(),
  })
  .transform((c) => ({
    awsRegion: c.AWS_REGION,
  }));

export type AWSConfig = z.infer<typeof AWSConfig>;
