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

type CanceledArchivingEventType =
  | "EServiceArchivingCanceled"
  | "EServiceDescriptorArchivingCanceled";

type CanceledArchivingEvent = Extract<
  EServiceEventV2,
  { type: CanceledArchivingEventType }
>;

export async function handleEserviceArchivingCanceledToConsumer(
  msg: CanceledArchivingEvent,
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

  // archiving was canceled: agreements are not archived, only fetch active ones
  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id
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
  msg: CanceledArchivingEvent,
  eservice: EService
): { body: string; descriptor: Descriptor } {
  return match(msg)
    .with(
      { type: "EServiceDescriptorArchivingCanceled" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          body: inAppTemplates.eserviceArchivingCanceledDescriptorToConsumer(
            eservice.name,
            descriptor.version
          ),
          descriptor,
        };
      }
    )
    .with({ type: "EServiceArchivingCanceled" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      return {
        body: inAppTemplates.eserviceArchivingCanceledEserviceToConsumer(
          eservice.name
        ),
        descriptor,
      };
    })
    .exhaustive();
}
