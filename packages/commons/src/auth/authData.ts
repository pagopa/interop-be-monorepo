/* eslint-disable @typescript-eslint/naming-convention */
import { z } from "zod";

export const AuthJWTToken = z.object({
  organizationId: z.string().uuid(),
  "user-roles": z.string(),
  sub: z.string().uuid(),
});
export type AuthJWTToken = z.infer<typeof AuthJWTToken>;

export const AuthData = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  userRoles: z.array(z.string()),
});
export type AuthData = z.infer<typeof AuthData>;
