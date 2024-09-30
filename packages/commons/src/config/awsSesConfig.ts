import { z } from "zod";
import { AWSConfig } from "./awsConfig.js";

export const AWSSesConfig = AWSConfig.and(
  z
    .object({
      AWS_SES_ENDPOINT: z.string().optional(),
    })
    .transform((c) => ({
      awsSesEndpoint: c.AWS_SES_ENDPOINT,
    }))
);

export type AWSSesConfig = z.infer<typeof AWSSesConfig>;
