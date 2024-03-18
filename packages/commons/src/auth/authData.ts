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

// TODO this model has only optional fields to catch all the possible cases.
// Improve by enumerating the possible tokens with their respective required / optional fields.
export const AuthToken = z.object({
  organizationId: TenantId.optional(),
  "user-roles": z
    .preprocess((val) => String(val).split(","), z.array(UserRoles))
    .optional(),
  role: UserRoles.optional(),
  uid: z.string().uuid().optional(),
  organization: z
    .object({
      roles: z.array(
        z.object({
          role: UserRoles,
        })
      ),
    })
    .optional(),
  externalId: z
    .object({
      origin: z.string(),
      value: z.string(),
    })
    .optional(),
  client_id: z.string().uuid().optional(),
});
export type AuthToken = z.infer<typeof AuthToken> & JwtPayload;

export const AuthData = z.object({
  organizationId: TenantId,
  userId: z.string().uuid(),
  userRoles: z.array(UserRoles),
  externalId: z.object({
    origin: z.string(),
    value: z.string(),
  }),
});
export type AuthData = z.infer<typeof AuthData>;
