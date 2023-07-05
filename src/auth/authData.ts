import { z } from "zod";

export const AuthJWTToken = z.object({
  organizationId: z.string().uuid(),
});
export type AuthJWTToken = z.infer<typeof AuthJWTToken>;

export const AuthData = z.object({
  organizationId: z.string().uuid(),
});
export type AuthData = z.infer<typeof AuthData>;
