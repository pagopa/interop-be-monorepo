import { z } from "zod";

export const AuthServiceConfig = z
  .object({
    AUTHORIZATION_MANAGEMENT_URL: z.string(),
  })
  .transform((c) => ({
    url: c.AUTHORIZATION_MANAGEMENT_URL,
  }));

export type AuthServiceConfig = z.infer<typeof AuthServiceConfig>;

export const authServiceConfig: () => AuthServiceConfig = () =>
  AuthServiceConfig.parse(process.env);
