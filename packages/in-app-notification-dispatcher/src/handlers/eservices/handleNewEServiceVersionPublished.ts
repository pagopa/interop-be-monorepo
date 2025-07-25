import {
  EServiceV2,
  fromEServiceV2,
  Notification,
  generateId,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { config } from "../../config/config.js";
import {
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../handlerCommons.js";

export async function handleNewEServiceVersionPublished(
  eserviceV2Msg: EServiceV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<Notification[]> {
  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorPublished"
    );
  }
  logger.info(
    `Sending in-app notification for handleNewEServiceVersionPublished ${eserviceV2Msg.id}`
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
      "newEServiceVersionPublished"
    );

  const body = inAppTemplates.newEServiceVersionPublished(eservice.name);

  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    id: generateId(),
    createdAt: new Date(),
    userId,
    tenantId,
    body,
    deepLink: `https://${config.interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
    readAt: undefined,
  }));
}
