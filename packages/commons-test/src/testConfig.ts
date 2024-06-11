import { EmailManagerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const EmailManagerConfigTest = EmailManagerConfig.and(
  z.object({
    smtpHTTPPort: z.number().optional(),
  })
);
export type EmailManagerConfigTest = z.infer<typeof EmailManagerConfigTest>;
