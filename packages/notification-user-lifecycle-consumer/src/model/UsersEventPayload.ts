import {
  BaseUsersEventPayload,
  relationshipStatus,
  SelfcareId,
  selfcareUserEventType,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
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
      productRole: data.user.productRole,
    },
  };

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
    ...baseEvent,
    eventType,
  } satisfies typeof baseEvent & { eventType: typeof eventType };
});

export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
