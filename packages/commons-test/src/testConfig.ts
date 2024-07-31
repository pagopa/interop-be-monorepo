import { AWSConfig, EmailManagerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const PECConfigTest = EmailManagerConfig.and(
  z.object({
    mailpitAPIPort: z.number().optional(),
  })
);
export type PECConfigTest = z.infer<typeof PECConfigTest>;

export const SESConfigTest = AWSConfig.and(
  z.object({
    sesAPIPort: z.number().optional(),
  })
);

export type SESConfigTest = z.infer<typeof SESConfigTest>;
