import { Logger } from "pagopa-interop-commons";
import {
  NewNotification,
  missingKafkaMessageDataError,
  fromDelegationV2,
  DelegationV2,
} from "pagopa-interop-models";
import {
  inAppTemplates,
  getNotificationRecipients,
  retrieveEservice,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type DelegationSubmittedRevokedToDelegateEventType =
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
    `Sending in-app notification for handleDelegationSubmittedRevokedToDelegate - entityId: ${delegationV2Msg.id}, eventType: ${eventType}`
  );

  const delegation = fromDelegationV2(delegationV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [delegation.delegateId],
    "delegationSubmittedRevokedToDelegate",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleDelegationSubmittedRevokedToDelegate - entityId: ${delegation.id}, eventType: ${eventType}`
    );
    return [];
  }

  const delegator = await retrieveTenant(
    delegation.delegatorId,
    readModelService
  );
  const eservice = await retrieveEservice(
    delegation.eserviceId,
    readModelService
  );

  const body = match(eventType)
    .with(
      "ProducerDelegationSubmitted",
      "ConsumerDelegationSubmitted",
      (eventType) =>
        inAppTemplates.delegationSubmittedToDelegate(
          eservice.name,
          delegator.name,
          eventType
        )
    )
    .with(
      "ProducerDelegationRevoked",
      "ConsumerDelegationRevoked",
      (eventType) =>
        inAppTemplates.delegationRevokedToDelegate(
          eservice.name,
          delegator.name,
          eventType
        )
    )
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "delegationSubmittedRevokedToDelegate",
    entityId: delegation.id,
  }));
}
