import * as z from "zod";
import { EmailManagerConfig } from "pagopa-interop-commons";

export const EmailManagerConfigTest = EmailManagerConfig.and(
  z.object({
    smtpHTTPPort: z.number().optional(),
  })
);
export type EmailManagerConfigTest = z.infer<typeof EmailManagerConfigTest>;
