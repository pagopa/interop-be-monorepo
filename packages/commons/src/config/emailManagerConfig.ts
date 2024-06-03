import { z } from "zod";

export const EmailManagerConfig = z
  .object({
    EMAIL_MANAGER_HOST: z.string(),
    EMAIL_MANAGER_PORT: z.coerce.number().min(1001),
    EMAIL_MANAGER_SENDER: z.string().email(),
  })
  .transform((c) => ({
    emailManagerHost: c.EMAIL_MANAGER_HOST,
    emailManagerPort: c.EMAIL_MANAGER_PORT,
    emailManagerSender: c.EMAIL_MANAGER_SENDER,
  }));

export type EmailManagerConfig = z.infer<typeof EmailManagerConfig>;

export const emailManagerConfig: () => EmailManagerConfig = () =>
  EmailManagerConfig.parse(process.env);
