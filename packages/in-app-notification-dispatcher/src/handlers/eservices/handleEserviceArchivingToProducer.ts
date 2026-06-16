import {
  Descriptor,
  DescriptorId,
  EService,
  EServiceEventV2,
  EServiceIdDescriptorId,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  getNotificationRecipients,
  inAppTemplates,
  retrieveDescriptor,
  retrieveLatestDescriptor,
} from "pagopa-interop-notification-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type ArchivingEventType =
  | "EServiceDescriptorArchivingScheduled"
  | "EServiceArchivingScheduled"
  | "EServiceDescriptorArchivingCompleted"
  | "EServiceArchivingCompleted"
  | "EServiceDescriptorArchived";

export type ArchivingEvent = Extract<
  EServiceEventV2,
  { type: ArchivingEventType }
>;

export async function handleEserviceArchivingToProducer(
  msg: ArchivingEvent,
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

  const recipients = await getNotificationRecipients(
    [eservice.producerId],
    "eserviceStateChangedToProducer",
    readModelService,
    logger
  );
  if (recipients.length === 0) {
    return [];
  }

  const { body, descriptor } = bodyAndDescriptorForProducer(msg, eservice);
  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptor.id}`
  );

  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToProducer",
    entityId,
  }));
}

function bodyAndDescriptorForProducer(
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
          body: inAppTemplates.eserviceArchivingStartedDescriptorToProducer(
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
        body: inAppTemplates.eserviceArchivingStartedEserviceToProducer(
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
          body: inAppTemplates.eserviceArchivingCompletedDescriptorToProducer(
            eservice.name,
            descriptor.version
          ),
          descriptor,
        };
      }
    )
    .with({ type: "EServiceArchivingCompleted" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return {
        body: inAppTemplates.eserviceArchivingCompletedEserviceToProducer(
          eservice.name
        ),
        descriptor,
      };
    })
    .with(
      { type: "EServiceDescriptorArchived" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          body: inAppTemplates.eserviceArchivingDescriptorArchivedToProducer(
            eservice.name,
            descriptor.version
          ),
          descriptor,
        };
      }
    )
    .exhaustive();
}
