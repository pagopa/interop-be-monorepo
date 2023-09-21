import { JwtPayload } from "jsonwebtoken";
import { z } from "zod";

export const AuthJWTToken = z.object({
  organizationId: z.string().uuid(),
  "user-roles": z
    .string()
    .optional()
    .transform((val) => val?.split(",")),
  role: z
    .string()
    .optional()
    .transform((val) => val?.split(",")),
  sub: z.string().uuid().optional(),
  uid: z.string().uuid().optional(),
  organization: z.object({
    roles: z.array(
      z.object({
        role: z.string(),
      })
    ),
  }),
});
export type AuthJWTToken = z.infer<typeof AuthJWTToken> & JwtPayload;

export const AuthData = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  userRoles: z.array(z.string()),
});
export type AuthData = z.infer<typeof AuthData>;
