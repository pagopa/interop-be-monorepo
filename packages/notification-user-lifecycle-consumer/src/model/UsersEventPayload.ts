import { UserRole } from "pagopa-interop-commons";
import { z } from "zod";

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
  userId: z.string().uuid(),
  name: z.string(),
  familyName: z.string(),
  email: z.string(),
  productRole: UserRole,
});

// Base event with common fields
const BaseEvent = z.object({
  id: z.string(),
  institutionId: z.string().trim().min(1), // Selfcare ID
  productId: z.string().trim().min(1),
});

// Add user event (only with active status)
const AddUserEvent = BaseEvent.extend({
  eventType: z.literal(selfcareUserEventType.add),
  user: BaseUser.extend({
    relationshipStatus: z.literal(relationshipStatus.active),
  }),
});

// Update user event (can be active or deleted status)
const UpdateUserEvent = BaseEvent.extend({
  eventType: z.literal(selfcareUserEventType.update),
  user: BaseUser.extend({
    relationshipStatus: z.union([
      z.literal(relationshipStatus.active),
      z.literal(relationshipStatus.deleted),
    ]),
  }),
});

// Combined schema
// Base payload type before transformation
export const BaseUsersEventPayload = z.union([AddUserEvent, UpdateUserEvent]);
type BaseUsersEventPayload = z.infer<typeof BaseUsersEventPayload>;

// Transformed payload with simplified event type
export const UsersEventPayload = BaseUsersEventPayload.transform((data) => {
  const baseEvent = {
    id: data.id,
    institutionId: data.institutionId,
    productId: data.productId,
    user: {
      userId: data.user.userId,
      name: data.user.name,
      familyName: data.user.familyName,
      email: data.user.email,
      productRole: data.user.productRole,
    },
  };

  if (data.eventType === selfcareUserEventType.add) {
    return {
      ...baseEvent,
      eventType: "add" as const,
    };
  }

  // For update events, check the relationship status
  if (data.user.relationshipStatus === relationshipStatus.deleted) {
    return {
      ...baseEvent,
      eventType: "delete" as const,
    };
  }

  return {
    ...baseEvent,
    eventType: "update" as const,
  };
});

export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
