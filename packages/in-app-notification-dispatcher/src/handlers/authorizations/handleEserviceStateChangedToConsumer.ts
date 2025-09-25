import { Logger } from "pagopa-interop-commons";
import {
  EServiceId,
  NewNotification,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { retrieveEservice, retrieveTenant } from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handleEserviceStateChangedToConsumer(
  eserviceId: string,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  logger.info(
    `Sending in-app notification for handleEserviceStateChangedToConsumer ${eserviceId}`
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
  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      consumers.map((consumer) => consumer.id),
      "eserviceStateChangedToConsumer"
    );

  const body = inAppTemplates.producerKeychainEServiceAddedToConsumer(
    producer.name,
    eservice.name
  );

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceStateChangedToConsumer",
    entityId: eservice.id,
  }));
}
