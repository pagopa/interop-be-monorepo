import {
  NewNotification,
  EServiceV2,
  missingKafkaMessageDataError,
  fromEServiceV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { retrieveTenant } from "../handlerCommons.js";
import { config } from "../../config/config.js";
import { activeProducerDelegationNotFound } from "../../models/errors.js";

export async function handleEserviceNewVersionSubmittedToDelegator(
  eserviceV2Msg: EServiceV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "agreement",
      "EServiceDescriptorSubmittedByDelegate"
    );
  }
  logger.info(
    `Handle eservice new version submitted in-app notification for eservice ${eserviceV2Msg.id}`
  );

  const eservice = fromEServiceV2(eserviceV2Msg);

  const producerDelegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );

  if (!producerDelegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [eservice.producerId],
      // FIXME use correct notification type
      "newEServiceVersionPublishedToConsumer"
    );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for eservice ${eserviceV2Msg.id}`
    );
    return [];
  }

  const delegate = await retrieveTenant(
    producerDelegation.delegateId,
    readModelService
  );

  const body = inAppTemplates.eserviceNewVersionSubmittedToDelegator(
    delegate.name,
    eservice.name
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    // FIXME maybe deep link should be to eservice descriptor?
    deepLink: `https://${config.interopFeBaseUrl}/ui/it/aderente/deleghe/${producerDelegation.id}`,
  }));
}
