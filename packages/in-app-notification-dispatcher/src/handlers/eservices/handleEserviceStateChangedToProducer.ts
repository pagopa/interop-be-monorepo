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
import { match, P } from "ts-pattern";
import {
  getNotificationRecipients,
  inAppTemplates,
  retrieveDescriptor,
} from "pagopa-interop-notification-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type EServiceStateChangedEventType =
  | "EServiceDescriptorSuspended"
  | "EServiceDescriptorActivated";

type EServiceStateChangedEvent = Extract<
  EServiceEventV2,
  { type: EServiceStateChangedEventType }
>;

export async function handleEserviceStateChangedToProducer(
  msg: EServiceStateChangedEvent,
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

  const descriptor = retrieveDescriptor(
    eservice,
    unsafeBrandId<DescriptorId>(msg.data.descriptorId)
  );

  const body = getNotificationBodyForProducer(msg, eservice, descriptor);

  if (!body) {
    return [];
  }

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

function getNotificationBodyForProducer(
  msg: EServiceStateChangedEvent,
  eservice: EService,
  descriptor: Descriptor
): string | undefined {
  return match(msg)
    .with({ type: "EServiceDescriptorActivated" }, () =>
      match(descriptor)
        .with({ archivingSchedule: P.nonNullable }, ({ archivingSchedule }) =>
          inAppTemplates.eserviceArchivingDescriptorActivatedToProducer(
            eservice.name,
            descriptor.version,
            archivingSchedule.archivableOn
          )
        )
        .otherwise(() => undefined)
    )
    .with({ type: "EServiceDescriptorSuspended" }, () =>
      match(descriptor)
        .with({ archivingSchedule: P.nonNullable }, ({ archivingSchedule }) =>
          inAppTemplates.eserviceArchivingDescriptorSuspendedToProducer(
            eservice.name,
            descriptor.version,
            archivingSchedule.archivableOn
          )
        )
        .otherwise(() => undefined)
    )
    .exhaustive();
}
