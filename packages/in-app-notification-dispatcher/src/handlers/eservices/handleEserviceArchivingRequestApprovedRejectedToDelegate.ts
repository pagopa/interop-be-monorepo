import { Logger } from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceEventV2,
  NewNotification,
  fromEServiceV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  activeProducerDelegationNotFound,
  getNotificationRecipients,
  inAppTemplates,
  retrieveDescriptor,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type ArchivingRequestApprovedRejectedEventType =
  | "EServiceDescriptorArchivingRequestApprovedByDelegator"
  | "EServiceDescriptorArchivingRequestRejectedByDelegator"
  | "EServiceArchivingRequestApprovedByDelegator"
  | "EServiceArchivingRequestRejectedByDelegator";

type ArchivingRequestApprovedRejectedEvent = Extract<
  EServiceEventV2,
  { type: ArchivingRequestApprovedRejectedEventType }
>;

export async function handleEserviceArchivingRequestApprovedRejectedToDelegate(
  msg: ArchivingRequestApprovedRejectedEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", msg.type);
  }
  const eservice = fromEServiceV2(msg.data.eservice);

  logger.info(
    `Sending in-app notification to delegate for ${msg.type} - eservice ${eservice.id}`
  );

  const producerDelegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );

  if (!producerDelegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }

  const usersWithNotifications = await getNotificationRecipients(
    [producerDelegation.delegateId],
    "eserviceArchivingApprovedRejectedToDelegate",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceArchivingRequestApprovedRejectedToDelegate - entityId: ${eservice.id}, eventType: ${msg.type}`
    );
    return [];
  }

  const delegator = await retrieveTenant(eservice.producerId, readModelService);

  const body = match(msg)
    .with(
      { type: "EServiceDescriptorArchivingRequestApprovedByDelegator" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return inAppTemplates.eserviceDescriptorArchivingRequestApprovedByDelegatorToDelegate(
          delegator.name,
          descriptor.version,
          eservice.name,
          descriptor.archivingSchedule?.archivableOn
        );
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingRequestRejectedByDelegator" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return inAppTemplates.eserviceDescriptorArchivingRequestRejectedByDelegatorToDelegate(
          delegator.name,
          descriptor.version,
          eservice.name
        );
      }
    )
    .with({ type: "EServiceArchivingRequestApprovedByDelegator" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return inAppTemplates.eserviceArchivingRequestApprovedByDelegatorToDelegate(
        delegator.name,
        eservice.name,
        descriptor.archivingSchedule?.archivableOn
      );
    })
    .with({ type: "EServiceArchivingRequestRejectedByDelegator" }, () =>
      inAppTemplates.eserviceArchivingRequestRejectedByDelegatorToDelegate(
        delegator.name,
        eservice.name
      )
    )
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceArchivingApprovedRejectedToDelegate",
    entityId: producerDelegation.id,
  }));
}
