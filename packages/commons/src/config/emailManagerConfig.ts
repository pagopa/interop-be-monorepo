import { z } from "zod";

export const EmailManagerConfig = z
  .object({
    EMAIL_MANAGER_HOST: z.string(),
    EMAIL_MANAGER_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    emailManagerHost: c.EMAIL_MANAGER_HOST,
    emailManagerPort: c.EMAIL_MANAGER_PORT,
  }));

export type EmailManagerConfig = z.infer<typeof EmailManagerConfig>;

export const emailManagerConfig: () => EmailManagerConfig = () =>
  EmailManagerConfig.parse(process.env);
