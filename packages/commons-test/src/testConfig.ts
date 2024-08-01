import { PecEmailManagerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const EmailManagerConfigTest = PecEmailManagerConfig.and(
  z.object({
    mailpitAPIPort: z.number().optional(),
  })
);
export type EmailManagerConfigTest = z.infer<typeof EmailManagerConfigTest>;
