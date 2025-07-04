import { EServiceV2, fromEServiceV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { InAppNotificationServiceSQL } from "../services/inAppNotificationServiceSQL.js";
import { config } from "../config/config.js";
import { inAppTemplates } from "../templates/inAppTemplates.js";
import {
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "./handlerCommons.js";

export async function handleNewEServiceVersionPublished(
  eserviceV2Msg: EServiceV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  inAppNotificationService: InAppNotificationServiceSQL
): Promise<void> {
  logger.info(
    `Sending in-app notification for new descriptor published eservice ${eserviceV2Msg.id}`
  );

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptor = retrieveLatestPublishedDescriptor(eservice);

  const [agreements] = await Promise.all([
    readModelService.getAgreementsByEserviceId(eservice.id),
  ]);

  if (agreements && agreements.length > 0) {
    const consumers = await Promise.all(
      agreements.map((consumer) =>
        retrieveTenant(consumer.consumerId, readModelService)
      )
    );
    const userNotificationConfigs =
      await readModelService.getUserNotificationConfigsByTenantIds(
        consumers.map((consumer) => consumer.id),
        "newEServiceVersionPublished"
      );

    const body = inAppTemplates.newEServiceVersionPublished(eservice.name);

    const notifications = userNotificationConfigs.map(
      ({ userId, tenantId }) => ({
        userId,
        tenantId,
        body,
        deepLink: `https://${config.interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
      })
    );

    await inAppNotificationService.insertNotifications(notifications);
  }
}
