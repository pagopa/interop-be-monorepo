import { Logger } from "pagopa-interop-commons";
import {
  EServiceId,
  EServiceIdDescriptorId,
  NewNotification,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveEservice,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handleEserviceStateChangedToConsumer(
  eserviceId: string,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  logger.info(
    `Sending in-app notification for handleEserviceStateChangedToConsumer - entityId: ${eserviceId}, eventType: ProducerKeychainEServiceAdded`
  );

  const eservice = await retrieveEservice(
    unsafeBrandId<EServiceId>(eserviceId),
    readModelService
  );

  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id
  );

  if (!agreements || agreements.length === 0) {
    return [];
  }

  const consumers = await Promise.all(
    agreements.map((agreement) =>
      retrieveTenant(agreement.consumerId, readModelService)
    )
  );
  const usersWithNotifications = await getNotificationRecipients(
    consumers.map((consumer) => consumer.id),
    "eserviceStateChangedToConsumer",
    readModelService,
    logger
  );

  const body = inAppTemplates.producerKeychainEServiceAddedToConsumer(
    producer.name,
    eservice.name
  );

  const descriptor = retrieveLatestDescriptor(eservice);
  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptor.id}`
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId,
  }));
}
