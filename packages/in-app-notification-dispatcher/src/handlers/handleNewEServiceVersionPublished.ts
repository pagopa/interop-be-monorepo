import { EServiceV2, fromEServiceV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { InAppNotificationServiceSQL } from "../services/inAppNotificationServiceSQL.js";
import { config } from "../config/config.js";
import {
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "./handlerCommons.js";

export default async function handleNewEServiceVersionPublished(
  eserviceV2Msg: EServiceV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  inAppNotificationService: InAppNotificationServiceSQL
): Promise<void> {
  logger.info(`New descriptor published for eservice ${eserviceV2Msg.id}`);

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

    const notifications = userNotificationConfigs.map(
      ({ userId, tenantId }) => ({
        userId,
        tenantId,
        body: `Gentile aderente, ti informiamo che per l'e-service <strong>${eservice.name}</strong>, è stata pubblicata una nuova versione. Pertanto, ti consigliamo di procedere all'aggiornamento dell'e-service alla versione più recente.`,
        deepLink: `https://${config.interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
      })
    );

    await inAppNotificationService.insertNotifications(notifications);
  }
}
