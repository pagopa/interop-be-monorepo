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

type ArchivingRequestedByDelegateEventType =
  | "EServiceDescriptorArchivingRequestedByDelegate"
  | "EServiceArchivingRequestedByDelegate";

type ArchivingRequestedByDelegateEvent = Extract<
  EServiceEventV2,
  { type: ArchivingRequestedByDelegateEventType }
>;

export async function handleEserviceArchivingRequestedToDelegator(
  msg: ArchivingRequestedByDelegateEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", msg.type);
  }
  const eservice = fromEServiceV2(msg.data.eservice);

  logger.info(
    `Sending in-app notification to delegator for ${msg.type} - eservice ${eservice.id}`
  );

  const producerDelegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );

  if (!producerDelegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }

  const usersWithNotifications = await getNotificationRecipients(
    [eservice.producerId],
    "eserviceArchivingRequestedToDelegator",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceArchivingRequestedToDelegator - entityId: ${eservice.id}, eventType: ${msg.type}`
    );
    return [];
  }

  const delegate = await retrieveTenant(
    producerDelegation.delegateId,
    readModelService
  );

  const body = match(msg)
    .with(
      { type: "EServiceDescriptorArchivingRequestedByDelegate" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return inAppTemplates.eserviceDescriptorArchivingRequestedByDelegateToDelegator(
          delegate.name,
          descriptor.version,
          eservice.name
        );
      }
    )
    .with({ type: "EServiceArchivingRequestedByDelegate" }, () => {
      retrieveLatestDescriptor(eservice);
      return inAppTemplates.eserviceArchivingRequestedByDelegateToDelegator(
        delegate.name,
        eservice.name
      );
    })
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceArchivingRequestedToDelegator",
    entityId: producerDelegation.id,
  }));
}
