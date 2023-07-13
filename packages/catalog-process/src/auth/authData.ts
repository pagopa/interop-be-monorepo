/* eslint-disable @typescript-eslint/naming-convention */
import { z } from "zod";

/* 
 val SUB: String                                          = "sub"
  val BEARER: String                                       = "bearer"
  val UID: String                                          = "uid"
  val ORGANIZATION: String                                 = "organization"
  val USER_ROLES: String                                   = "user-roles"
  val CORRELATION_ID_HEADER: String                        = "X-Correlation-Id"
  val IP_ADDRESS: String                                   = "X-Forwarded-For"
  val INTEROP_PRODUCT_NAME: String                         = "prod-interop"
  val PURPOSE_ID_CLAIM: String                             = "purposeId"
  val DIGEST_CLAIM: String                                 = "digest"
  val ORGANIZATION_ID_CLAIM: String                        = "organizationId"
  val SELFCARE_ID_CLAIM: String                            = "selfcareId"
*/

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
