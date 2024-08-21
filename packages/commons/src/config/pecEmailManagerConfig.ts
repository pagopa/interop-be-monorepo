import { z } from "zod";

export const PecEmailManagerConfig = z
  .object({
    PEC_SMTP_ADDRESS: z.string(),
    PEC_SMTP_PORT: z.coerce.number(),
    PEC_SMTP_SECURE: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    PEC_SMTP_USERNAME: z.string(),
    PEC_SMTP_PASSWORD: z.string(),
  })
  .transform((c) => ({
    smtpAddress: c.PEC_SMTP_ADDRESS,
    smtpPort: c.PEC_SMTP_PORT,
    smtpSecure: c.PEC_SMTP_SECURE,
    smtpUsername: c.PEC_SMTP_USERNAME,
    smtpPassword: c.PEC_SMTP_PASSWORD,
  }));

export type PecEmailManagerConfig = z.infer<typeof PecEmailManagerConfig>;
