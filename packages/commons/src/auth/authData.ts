import { JwtPayload } from "jsonwebtoken";
import { TenantId } from "pagopa-interop-models";
import { z } from "zod";

export const userRoles = {
  ADMIN_ROLE: "admin",
  SECURITY_ROLE: "security",
  API_ROLE: "api",
  M2M_ROLE: "m2m",
  INTERNAL_ROLE: "internal",
  SUPPORT_ROLE: "support",
} as const;

export const UserRoles = z.enum([
  Object.values(userRoles)[0],
  ...Object.values(userRoles).slice(1),
]);
export type UserRoles = z.infer<typeof UserRoles>;

export const AuthJWTToken = z.object({
  organizationId: TenantId,
  "user-roles": z
    .string()
    .optional()
    .transform((val) => val?.split(",")),
  role: z
    .string()
    .optional()
    .transform((val) => val?.split(",")),
  uid: z.string().uuid().optional(),
  organization: z.object({
    roles: z.array(
      z.object({
        role: z.string(),
      })
    ),
  }),
  externalId: z.object({
    origin: z.string(),
    value: z.string(),
  }),
});
export type AuthJWTToken = z.infer<typeof AuthJWTToken> & JwtPayload;

export const AuthData = z.object({
  organizationId: TenantId,
  userId: z.string().uuid(),
  userRoles: z.array(z.string()),
  externalId: z.object({
    origin: z.string(),
    value: z.string(),
  }),
});
export type AuthData = z.infer<typeof AuthData>;
