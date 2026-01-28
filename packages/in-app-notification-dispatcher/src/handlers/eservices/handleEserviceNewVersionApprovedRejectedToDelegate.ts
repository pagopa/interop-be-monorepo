import {
  NewNotification,
  EServiceV2,
  missingKafkaMessageDataError,
  fromEServiceV2,
  DescriptorId,
  EServiceIdDescriptorId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  getNotificationRecipients,
  retrieveTenant,
} from "../handlerCommons.js";
import { activeProducerDelegationNotFound } from "../../models/errors.js";

export type EserviceNewVersionApprovedRejectedToDelegateEventType =
  | "EServiceDescriptorApprovedByDelegator"
  | "EServiceDescriptorRejectedByDelegator";

export async function handleEserviceNewVersionApprovedRejectedToDelegate(
  eserviceV2Msg: EServiceV2 | undefined,
  descriptorId: DescriptorId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: EserviceNewVersionApprovedRejectedToDelegateEventType
): Promise<NewNotification[]> {
  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }
  logger.info(
    `Sending in-app notification for handleEserviceNewVersionApprovedRejectedToDelegate - entityId: ${eserviceV2Msg.id}, eventType: ${eventType}`
  );

  const eservice = fromEServiceV2(eserviceV2Msg);

  const producerDelegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );

  if (!producerDelegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }

  const usersWithNotifications = await getNotificationRecipients(
    [producerDelegation.delegateId],
    "eserviceNewVersionApprovedRejectedToDelegate",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceNewVersionApprovedRejectedToDelegate - entityId: ${eservice.id}, eventType: ${eventType}`
    );
    return [];
  }

  const delegator = await retrieveTenant(eservice.producerId, readModelService);

  const body = inAppTemplates.eserviceNewVersionApprovedRejectedToDelegate(
    delegator.name,
    eservice.name,
    eventType
  );

  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptorId}`
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceNewVersionApprovedRejectedToDelegate",
    entityId,
  }));
}
