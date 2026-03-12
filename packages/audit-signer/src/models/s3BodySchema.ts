import { z } from "zod";

const S3BodySchema = z.object({
  Records: z
    .array(
      z.object({
        s3: z.object({
          object: z.object({
            key: z.string(),
          }),
        }),
      })
    )
    .nonempty(),
});

export type S3BodySchema = z.infer<typeof S3BodySchema>;
