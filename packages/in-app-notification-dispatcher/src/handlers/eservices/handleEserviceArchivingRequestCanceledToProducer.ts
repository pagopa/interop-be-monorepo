import { Logger } from "pagopa-interop-commons";
import {
  EServiceIdDescriptorId,
  EServiceEventV2,
  NewNotification,
  fromEServiceV2,
  missingKafkaMessageDataError,
  bigIntToDate,
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
  const requestedOn = bigIntToDate(msg.data.requestedOn);

  const body =
    inAppTemplates.eserviceArchivingRequestRejectedByDelegatorToProducer(
      delegate.name,
      requestedOn
    );
  const entityId = match(msg)
    .with(
      { type: "EServiceDescriptorArchivingRequestCanceledByDelegate" },
      ({ data: { descriptorId } }) =>
        EServiceIdDescriptorId.parse(`${eservice.id}/${descriptorId}`)
    )
    .with({ type: "EServiceArchivingRequestCanceledByDelegate" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return EServiceIdDescriptorId.parse(`${eservice.id}/${descriptor.id}`);
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
