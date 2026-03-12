import { unsafeBrandId, UserId } from "pagopa-interop-models";
import { z } from "zod";

export const SUPPORT_USER_ID = unsafeBrandId<UserId>(
  "5119b1fa-825a-4297-8c9c-152e055cabca"
);

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

// System roles = special non-UI tokens
export const systemRole = {
  M2M_ROLE: "m2m",
  M2M_ADMIN_ROLE: "m2m-admin",
  INTERNAL_ROLE: "internal",
  MAINTENANCE_ROLE: "maintenance",
} as const;

export const SystemRole = z.enum([
  Object.values(systemRole)[0],
  ...Object.values(systemRole).slice(1),
]);
export type SystemRole = z.infer<typeof SystemRole>;
