import { z } from "zod";
import { UserId, TenantId } from "../brandedIds.js";

export const userRole = {
  ADMIN_ROLE: "admin",
  SECURITY_ROLE: "security",
  API_ROLE: "api",
  SUPPORT_ROLE: "support",
} as const;

export const UserRole = z.enum([
  Object.values(userRole)[0],
  ...Object.values(userRole).slice(1),
]);
export type UserRole = z.infer<typeof UserRole>;

export const User = z.object({
  id: UserId,
  tenantId: TenantId,
  name: z.string(),
  familyName: z.string(),
  email: z.string().email(),
  productRole: UserRole,
});
export type User = z.infer<typeof User>;
