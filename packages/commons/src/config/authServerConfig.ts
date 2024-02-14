import { z } from "zod";

export const AuthServiceConfig = z
  .object({
    AUTH_SERVICE_URL: z.string(),
  })
  .transform((c) => ({
    url: c.AUTH_SERVICE_URL,
  }));

export type AuthServiceConfig = z.infer<typeof AuthServiceConfig>;

export const authServiceConfig: () => AuthServiceConfig = () =>
  AuthServiceConfig.parse(process.env);
