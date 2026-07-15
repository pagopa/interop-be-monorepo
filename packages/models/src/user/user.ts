import { z } from "zod";
import { match, P } from "ts-pattern";
import { UserId, TenantId, SelfcareId, unsafeBrandId } from "../brandedIds.js";

export const userRole = {
  ADMIN_ROLE: "admin",
  SECURITY_ROLE: "security",
  API_ROLE: "api",
  SUPPORT_ROLE: "support",
  REVIEWER_ROLE: "reviewer",
  VIEWER_ROLE: "viewer",
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

export const selfcareUserEventType = {
  add: "ADD",
  update: "UPDATE",
} as const;

export const SelfcareUserEventType = z.enum([
  selfcareUserEventType.add,
  selfcareUserEventType.update,
]);
export type SelfcareUserEventType = z.infer<typeof SelfcareUserEventType>;

export const relationshipStatus = {
  active: "ACTIVE",
  suspended: "SUSPENDED",
  deleted: "DELETED",
  rejected: "REJECTED",
} as const;
export const RelationshipStatus = z.enum([
  Object.values(relationshipStatus)[0],
  ...Object.values(relationshipStatus).slice(1),
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatus>;

const BaseUser = z.object({
  userId: z.string().uuid().nullish(),
  name: z.string(),
  familyName: z.string(),
  email: z.string(),
  role: z.string(),
  productRole: UserRole,
  relationshipStatus: RelationshipStatus,
  mobilePhone: z.string().nullish(),
});

export const BaseUsersEventPayload = z.object({
  id: z.string(),
  institutionId: z.string().trim().min(1), // Selfcare ID
  productId: z.string().trim().min(1),
  eventType: SelfcareUserEventType,
  user: BaseUser,
});
export type BaseUsersEventPayload = z.infer<typeof BaseUsersEventPayload>;

// Shared transform: brands the ids and simplifies the event type.
// relationshipStatus is kept in the output because selfcare-client-users-updater
// needs the distinction that the simplified event type would otherwise drop.
export const UsersEventPayload = BaseUsersEventPayload.transform((data) => {
  const { userId } = data.user;
  if (userId == null) {
    throw new Error("UserId is required and cannot be null or undefined.");
  }

  const eventType = match([data.eventType, data.user.relationshipStatus])
    .with([selfcareUserEventType.add, P.any], () => "add" as const)
    .with(
      [selfcareUserEventType.update, P.not(relationshipStatus.deleted)],
      () => "update" as const
    )
    .with(
      [selfcareUserEventType.update, relationshipStatus.deleted],
      () => "delete" as const
    )
    .exhaustive();

  return {
    id: data.id,
    institutionId: unsafeBrandId<SelfcareId>(data.institutionId),
    productId: data.productId,
    user: {
      userId: unsafeBrandId<UserId>(userId),
      productRole: data.user.productRole,
      relationshipStatus: data.user.relationshipStatus,
    },
    eventType,
  };
});
export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
