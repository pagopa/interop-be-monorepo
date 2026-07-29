import { Logger } from "pagopa-interop-commons";
import {
  Descriptor,
  DescriptorId,
  EService,
  EServiceEventV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
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

type EServiceArchivingRequestSubmittedToDelegatorEventType =
  | "EServiceArchivingRequestedByDelegate"
  | "EServiceDescriptorArchivingRequestedByDelegate";

type EServiceArchivingRequestSubmittedToDelegatorEvent = Extract<
  EServiceEventV2,
  { type: EServiceArchivingRequestSubmittedToDelegatorEventType }
>;

export async function handleEserviceArchivingRequestSubmittedToDelegator(
  msg: EServiceArchivingRequestSubmittedToDelegatorEvent,
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

  const recipients = await getNotificationRecipients(
    [eservice.producerId],
    "eserviceArchivingRequestSubmittedToDelegator",
    readModelService,
    logger
  );

  if (recipients.length === 0) {
    return [];
  }

  const delegate = await retrieveTenant(
    producerDelegation.delegateId,
    readModelService
  );
  const { body } = bodyAndDescriptorForDelegator(msg, eservice, delegate.name);

  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceArchivingRequestSubmittedToDelegator",
    entityId: producerDelegation.id,
  }));
}

function bodyAndDescriptorForDelegator(
  msg: EServiceArchivingRequestSubmittedToDelegatorEvent,
  eservice: EService,
  delegateName: string
): { body: string; descriptor: Descriptor } {
  return match(msg)
    .with(
      {
        type: "EServiceDescriptorArchivingRequestedByDelegate",
      },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );

        return {
          body: inAppTemplates.eserviceDescriptorArchivingRequestSubmittedToDelegator(
            delegateName,
            eservice.name,
            descriptor.version
          ),
          descriptor,
        };
      }
    )
    .with(
      {
        type: "EServiceArchivingRequestedByDelegate",
      },
      () => {
        const descriptor = retrieveLatestDescriptor(eservice);

        return {
          body: inAppTemplates.eserviceArchivingRequestSubmittedToDelegator(
            delegateName,
            eservice.name
          ),
          descriptor,
        };
      }
    )
    .exhaustive();
}
