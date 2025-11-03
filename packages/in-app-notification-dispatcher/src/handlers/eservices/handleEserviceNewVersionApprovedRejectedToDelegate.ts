import {
  NewNotification,
  EServiceV2,
  missingKafkaMessageDataError,
  fromEServiceV2,
  DescriptorId,
  EService,
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
    `Handle eservice new version approved/rejected in-app notification for eservice ${eserviceV2Msg.id}`
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
      `No users with notifications enabled for eservice ${eserviceV2Msg.id}`
    );
    return [];
  }

  const delegator = await retrieveTenant(eservice.producerId, readModelService);

  const rejectionReason = getLastRejectionReason(eservice, descriptorId);

  const body = inAppTemplates.eserviceNewVersionApprovedRejectedToDelegate(
    delegator.name,
    eservice.name,
    eventType,
    rejectionReason
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

const getLastRejectionReason = (
  eservice: EService,
  descriptorId: DescriptorId
): string | undefined => {
  const descriptor = eservice.descriptors.find(
    (descriptor) => descriptor.id === descriptorId
  );
  if (
    !descriptor?.rejectionReasons ||
    descriptor.rejectionReasons.length === 0
  ) {
    return undefined;
  }
  const mostRecentRejection = descriptor.rejectionReasons.reduce(
    (latest, current) =>
      current.rejectedAt > latest.rejectedAt ? current : latest
  );
  return mostRecentRejection.rejectionReason;
};
