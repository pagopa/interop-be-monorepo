import { Logger } from "pagopa-interop-commons";
import {
  EServiceIdDescriptorId,
  EServiceEventV2,
  NewNotification,
  fromEServiceV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import {
  activeProducerDelegationNotFound,
  getNotificationRecipients,
  inAppTemplates,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type ArchivingRequestCanceledEventType =
  | "EServiceDescriptorArchivingRequestCanceledByDelegate"
  | "EServiceArchivingRequestCanceledByDelegate";

type ArchivingRequestCanceledEvent = Extract<
  EServiceEventV2,
  { type: ArchivingRequestCanceledEventType }
>;

export async function handleEserviceArchivingRequestCanceledToProducer(
  msg: ArchivingRequestCanceledEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", msg.type);
  }
  const eservice = fromEServiceV2(msg.data.eservice);

  logger.info(
    `Sending in-app notification to producer for ${msg.type} - eservice ${eservice.id}`
  );

  const producerDelegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );

  if (!producerDelegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }

  const usersWithNotifications = await getNotificationRecipients(
    [producerDelegation.delegatorId],
    "eserviceArchivingRequestedToDelegator",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceArchivingRequestCanceledToProducer - entityId: ${eservice.id}, eventType: ${msg.type}`
    );
    return [];
  }

  const delegate = await retrieveTenant(
    producerDelegation.delegateId,
    readModelService
  );

  const { body, entityId } = match<
    ArchivingRequestCanceledEvent,
    { body: string; entityId: EServiceIdDescriptorId }
  >(msg)
    .with(
      { type: "EServiceDescriptorArchivingRequestCanceledByDelegate" },
      ({ data: { descriptorId } }) => {
        const descriptor =
          eservice.descriptors.find((d) => d.id === descriptorId) ??
          retrieveLatestDescriptor(eservice);
        const body =
          inAppTemplates.eserviceDescriptorArchivingRequestCanceledToProducer(
            delegate.name,
            eservice.name,
            descriptor.version
          );
        const entityId = EServiceIdDescriptorId.parse(
          `${eservice.id}/${descriptor.id}`
        );
        return { body, entityId };
      }
    )
    .with({ type: "EServiceArchivingRequestCanceledByDelegate" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      const body = inAppTemplates.eserviceArchivingRequestCanceledToProducer(
        delegate.name,
        eservice.name
      );
      const entityId = EServiceIdDescriptorId.parse(
        `${eservice.id}/${descriptor.id}`
      );
      return { body, entityId };
    })
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceArchivingRequestedToDelegator",
    entityId,
  }));
}
