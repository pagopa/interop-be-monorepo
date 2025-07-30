import {
  EServiceV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../handlerCommons.js";

<<<<<<<< HEAD:packages/in-app-notification-dispatcher/src/handlers/eservices/handleEserviceStateChangedToConsumer.ts
export async function handleEserviceStateChangedToConsumer(
========
export async function handleEserviceStatusChangedToConsumer(
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/src/handlers/eservices/handleEserviceStatusChangedToConsumer.ts
  eserviceV2Msg: EServiceV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorPublished"
    );
  }
  logger.info(
<<<<<<<< HEAD:packages/in-app-notification-dispatcher/src/handlers/eservices/handleEserviceStateChangedToConsumer.ts
    `Sending in-app notification for handleEserviceStateChangedToConsumer ${eserviceV2Msg.id}`
========
    `Sending in-app notification for handleEserviceStatusChangedToConsumer ${eserviceV2Msg.id}`
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/src/handlers/eservices/handleEserviceStatusChangedToConsumer.ts
  );

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptor = retrieveLatestPublishedDescriptor(eservice);

  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id
  );

  if (!agreements || agreements.length === 0) {
    return [];
  }

  const consumers = await Promise.all(
    agreements.map((consumer) =>
      retrieveTenant(consumer.consumerId, readModelService)
    )
  );
  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      consumers.map((consumer) => consumer.id),
      "eserviceStateChangedToConsumer"
    );

  const body = inAppTemplates.eserviceStateChangedToConsumer(eservice.name);

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId: descriptor.id,
  }));
}
