import { z } from "zod";

export const EmailManagerConfig = z
  .object({
    SMTP_ADDRESS: z.string(),
    SMTP_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    smtpAddress: c.SMTP_ADDRESS,
    smtpPort: c.SMTP_PORT,
  }));

export type EmailManagerConfig = z.infer<typeof EmailManagerConfig>;

export const emailManagerConfig: () => EmailManagerConfig = () =>
  EmailManagerConfig.parse(process.env);
