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

export type DelegationSubmittedRevokedToDelegateEventType =
  | "ProducerDelegationSubmitted"
  | "ConsumerDelegationSubmitted"
  | "ProducerDelegationRevoked"
  | "ConsumerDelegationRevoked";

export async function handleDelegationSubmittedRevokedToDelegate(
  delegationV2Msg: DelegationV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: DelegationSubmittedRevokedToDelegateEventType
): Promise<NewNotification[]> {
  if (!delegationV2Msg) {
    throw missingKafkaMessageDataError("delegation", eventType);
  }
  logger.info(
    `Handle delegation submitted/revoked in-app notification for delegation ${delegationV2Msg.id}`
  );

  const delegation = fromDelegationV2(delegationV2Msg);

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [delegation.delegateId],
      "delegationSubmittedRevokedToDelegate"
    );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for delegation ${delegationV2Msg.id}`
    );
    return [];
  }

  const delegator = await retrieveTenant(
    delegation.delegatorId,
    readModelService
  );

  const body = inAppTemplates.delegationSubmittedRevokedToDelegate(
    delegator.name,
    eventType
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "delegationSubmittedRevokedToDelegate",
    entityId: delegation.id,
  }));
}
