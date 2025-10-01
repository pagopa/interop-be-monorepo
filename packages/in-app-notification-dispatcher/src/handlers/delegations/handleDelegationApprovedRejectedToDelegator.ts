import {
  NewNotification,
  missingKafkaMessageDataError,
  fromDelegationV2,
  DelegationV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  getNotificationRecipients,
  retrieveTenant,
} from "../handlerCommons.js";

export type DelegationApprovedRejectedToDelegatorEventType =
  | "ProducerDelegationApproved"
  | "ConsumerDelegationApproved"
  | "ProducerDelegationRejected"
  | "ConsumerDelegationRejected";

export async function handleDelegationApprovedRejectedToDelegator(
  delegationV2Msg: DelegationV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL,
  eventType: DelegationApprovedRejectedToDelegatorEventType
): Promise<NewNotification[]> {
  if (!delegationV2Msg) {
    throw missingKafkaMessageDataError("delegation", eventType);
  }
  logger.info(
    `Handle delegation approved/rejected in-app notification for delegation ${delegationV2Msg.id}`
  );

  const delegation = fromDelegationV2(delegationV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [delegation.delegatorId],
    "delegationApprovedRejectedToDelegator",
    readModelService,
    userService
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for delegation ${delegationV2Msg.id}`
    );
    return [];
  }

  const delegate = await retrieveTenant(
    delegation.delegateId,
    readModelService
  );

  const body = inAppTemplates.delegationApprovedRejectedToDelegator(
    delegate.name,
    eventType,
    delegation.rejectionReason
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "delegationApprovedRejectedToDelegator",
    entityId: delegation.id,
  }));
}
