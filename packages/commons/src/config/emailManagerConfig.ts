import { z } from "zod";

export const EmailManagerConfig = z
  .object({
    SMTP_ADDRESS: z.string(),
    SMTP_PORT: z.coerce.number(),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    SMTP_USERNAME: z.string(),
    SMTP_PASSWORD: z.string(),
  })
  .transform((c) => ({
    smtpAddress: c.SMTP_ADDRESS,
    smtpPort: c.SMTP_PORT,
    smtpSecure: c.SMTP_SECURE,
    smtpUsername: c.SMTP_USERNAME,
    smtpPassword: c.SMTP_PASSWORD,
  }));

export type EmailManagerConfig = z.infer<typeof EmailManagerConfig>;
