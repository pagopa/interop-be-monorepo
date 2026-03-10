import {
  NewNotification,
  missingKafkaMessageDataError,
  fromDelegationV2,
  DelegationV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  getNotificationRecipients,
  retrieveEservice,
  retrieveTenant,
} from "../handlerCommons.js";

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
    `Handle delegation submitted/revoked in-app notification for delegation ${delegationV2Msg.id}`
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
      `No users with notifications enabled for delegation ${delegationV2Msg.id}`
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
