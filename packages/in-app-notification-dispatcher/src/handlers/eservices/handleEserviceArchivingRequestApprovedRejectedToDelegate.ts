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

type EServiceArchivingRequestApprovedRejectedToDelegateEventType =
  | "EServiceArchivingRequestApprovedByDelegator"
  | "EServiceArchivingRequestRejectedByDelegator"
  | "EServiceDescriptorArchivingRequestApprovedByDelegator"
  | "EServiceDescriptorArchivingRequestRejectedByDelegator";

type EServiceArchivingRequestApprovedRejectedToDelegateEvent = Extract<
  EServiceEventV2,
  { type: EServiceArchivingRequestApprovedRejectedToDelegateEventType }
>;

export async function handleEserviceArchivingRequestApprovedRejectedToDelegate(
  msg: EServiceArchivingRequestApprovedRejectedToDelegateEvent,
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

  const recipients = await getNotificationRecipients(
    [producerDelegation.delegateId],
    "eserviceArchivingRequestApprovedRejectedToDelegate",
    readModelService,
    logger
  );

  if (recipients.length === 0) {
    return [];
  }

  const delegator = await retrieveTenant(eservice.producerId, readModelService);
  const { body } = bodyAndDescriptorForDelegate(msg, eservice, delegator.name);

  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceArchivingRequestApprovedRejectedToDelegate",
    entityId: producerDelegation.id,
  }));
}

function bodyAndDescriptorForDelegate(
  msg: EServiceArchivingRequestApprovedRejectedToDelegateEvent,
  eservice: EService,
  delegatorName: string
): { body: string; descriptor: Descriptor } {
  return match(msg)
    .with(
      {
        type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );

        return {
          body: inAppTemplates.eserviceDescriptorArchivingRequestApprovedRejectedToDelegate(
            delegatorName,
            eservice.name,
            descriptor.version,
            descriptor.archivingSchedule?.archivableOn,
            msg.type
          ),
          descriptor,
        };
      }
    )
    .with(
      {
        type: "EServiceDescriptorArchivingRequestRejectedByDelegator",
      },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );

        return {
          body: inAppTemplates.eserviceDescriptorArchivingRequestApprovedRejectedToDelegate(
            delegatorName,
            eservice.name,
            descriptor.version,
            descriptor.archivingSchedule?.archivableOn,
            msg.type
          ),
          descriptor,
        };
      }
    )
    .with(
      {
        type: "EServiceArchivingRequestApprovedByDelegator",
      },
      () => {
        const descriptor = retrieveLatestDescriptor(eservice);

        return {
          body: inAppTemplates.eserviceArchivingRequestApprovedRejectedToDelegate(
            delegatorName,
            eservice.name,
            descriptor.archivingSchedule?.archivableOn,
            msg.type
          ),
          descriptor,
        };
      }
    )
    .with(
      {
        type: "EServiceArchivingRequestRejectedByDelegator",
      },
      () => {
        const descriptor = retrieveLatestDescriptor(eservice);

        return {
          body: inAppTemplates.eserviceArchivingRequestApprovedRejectedToDelegate(
            delegatorName,
            eservice.name,
            descriptor.archivingSchedule?.archivableOn,
            msg.type
          ),
          descriptor,
        };
      }
    )
    .exhaustive();
}
