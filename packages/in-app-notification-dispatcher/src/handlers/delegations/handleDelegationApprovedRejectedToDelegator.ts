import {
  NewNotification,
  missingKafkaMessageDataError,
  fromDelegationV2,
  DelegationV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { retrieveTenant } from "../handlerCommons.js";
import { config } from "../../config/config.js";

export type DelegationApprovedRejectedToDelegatorEventType =
  | "ProducerDelegationApproved"
  | "ConsumerDelegationApproved"
  | "ProducerDelegationRejected"
  | "ConsumerDelegationRejected";

export async function handleDelegationApprovedRejectedToDelegator(
  delegationV2Msg: DelegationV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: DelegationApprovedRejectedToDelegatorEventType
): Promise<NewNotification[]> {
  if (!delegationV2Msg) {
    throw missingKafkaMessageDataError("delegation", eventType);
  }
  logger.info(
    `Handle delegation approved/rejected in-app notification for delegation ${delegationV2Msg.id}`
  );

  const delegation = fromDelegationV2(delegationV2Msg);

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [delegation.delegatorId],
      // FIXME use correct notification type
      "newEServiceVersionPublishedToConsumer"
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
    deepLink: `https://${config.interopFeBaseUrl}/ui/it/aderente/deleghe/${delegationV2Msg.id}`,
  }));
}
