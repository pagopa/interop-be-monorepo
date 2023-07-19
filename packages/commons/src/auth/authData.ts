/* eslint-disable @typescript-eslint/naming-convention */
import { JwtPayload } from "jsonwebtoken";
import { z } from "zod";

export const AuthJWTToken = z.object({
  organizationId: z.string().uuid(),
  "user-roles": z.string(),
  role: z.string(),
  sub: z.string().uuid(),
  organization: z.object({
    roles: z.string(),
  }),
});
export type AuthJWTToken = z.infer<typeof AuthJWTToken> & JwtPayload;

export const AuthData = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  userRoles: z.array(z.string()),
});
export type AuthData = z.infer<typeof AuthData>;
