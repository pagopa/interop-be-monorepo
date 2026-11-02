import { Logger } from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  DescriptorId,
  EService,
  EServiceEventV2,
  EServiceIdDescriptorId,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
  Tenant,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
  retrieveDescriptor,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type ArchivingEventType =
  | "EServiceDescriptorArchivingScheduled"
  | "EServiceArchivingScheduled"
  | "EServiceDescriptorArchivingCompleted"
  | "EServiceArchivingCompleted";

type ArchivingEvent = Extract<EServiceEventV2, { type: ArchivingEventType }>;

export async function handleEserviceArchivingToConsumer(
  msg: ArchivingEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", msg.type);
  }
  const eservice = fromEServiceV2(msg.data.eservice);

  logger.info(
    `Sending in-app notification to consumers for ${msg.type} - eservice ${eservice.id}`
  );

  // when archiving is completed/early-archived, consumer agreements may
  // already be in archived state, so include them to reach those consumers
  const includeArchived =
    msg.type === "EServiceArchivingCompleted" ||
    msg.type === "EServiceDescriptorArchivingCompleted";

  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id,
    {
      includeArchived,
    }
  );
  if (!agreements || agreements.length === 0) {
    return [];
  }

  const consumers = await Promise.all(
    agreements.map((a: Agreement) =>
      retrieveTenant(a.consumerId, readModelService)
    )
  );

  const recipients = await getNotificationRecipients(
    consumers.map((c: Tenant) => c.id),
    "eserviceStateChangedToConsumer",
    readModelService,
    logger
  );
  if (recipients.length === 0) {
    return [];
  }

  const { body, descriptor } = bodyAndDescriptorForConsumer(msg, eservice);
  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptor.id}`
  );

  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId,
  }));
}

function bodyAndDescriptorForConsumer(
  msg: ArchivingEvent,
  eservice: EService
): { body: string; descriptor: Descriptor } {
  return match(msg)
    .with(
      { type: "EServiceDescriptorArchivingScheduled" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          body: inAppTemplates.eserviceArchivingStartedDescriptorToConsumer(
            eservice.name,
            descriptor.version,
            descriptor.archivingSchedule?.archivableOn
          ),
          descriptor,
        };
      }
    )
    .with({ type: "EServiceArchivingScheduled" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return {
        body: inAppTemplates.eserviceArchivingStartedEserviceToConsumer(
          eservice.name,
          descriptor.archivingSchedule?.archivableOn
        ),
        descriptor,
      };
    })
    .with(
      { type: "EServiceDescriptorArchivingCompleted" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          body: inAppTemplates.eserviceArchivingCompletedDescriptorToConsumer(
            eservice.name,
            descriptor.version,
            descriptor.archivingSchedule?.archivableOn
          ),
          descriptor,
        };
      }
    )
    .with({ type: "EServiceArchivingCompleted" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return {
        body: inAppTemplates.eserviceArchivingCompletedEserviceToConsumer(
          eservice.name,
          descriptor.archivingSchedule?.archivableOn
        ),
        descriptor,
      };
    })
    .exhaustive();
}
