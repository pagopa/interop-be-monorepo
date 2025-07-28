import {
  BaseUsersEventPayload,
  relationshipStatus,
  SelfcareId,
  selfcareUserEventType,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { z } from "zod";

// Transformed payload with simplified event type
export const UsersEventPayload = BaseUsersEventPayload.transform((data) => {
  const { userId } = data.user;
  if (userId == null || userId === undefined) {
    throw new Error("UserId is required and cannot be null or undefined.");
  }

  const baseEvent = {
    id: data.id,
    institutionId: unsafeBrandId<SelfcareId>(data.institutionId),
    productId: data.productId,
    user: {
      userId: unsafeBrandId<UserId>(userId),
      name: data.user.name,
      familyName: data.user.familyName,
      email: data.user.email,
      productRole: data.user.productRole,
    },
  };

  const eventType: "add" | "update" | "delete" =
    data.eventType === selfcareUserEventType.add
      ? "add"
      : data.user.relationshipStatus === relationshipStatus.deleted
      ? "delete"
      : "update";

  return {
    ...baseEvent,
    eventType,
  };
});

export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
