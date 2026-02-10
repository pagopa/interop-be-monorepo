import {
  NewNotification,
  EServiceV2,
  missingKafkaMessageDataError,
  fromEServiceV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  getNotificationRecipients,
  retrieveTenant,
} from "../handlerCommons.js";
import { activeProducerDelegationNotFound } from "../../models/errors.js";

export async function handleEserviceNewVersionSubmittedToDelegator(
  eserviceV2Msg: EServiceV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorSubmittedByDelegate"
    );
  }
  logger.info(
    `Sending in-app notification for handleEserviceNewVersionSubmittedToDelegator - entityId: ${eserviceV2Msg.id}, eventType: EServiceDescriptorSubmittedByDelegate`
  );

  const eservice = fromEServiceV2(eserviceV2Msg);

  const producerDelegation = await readModelService.getActiveProducerDelegation(
    eservice.id,
    eservice.producerId
  );

  if (!producerDelegation) {
    throw activeProducerDelegationNotFound(eservice.id);
  }

  const usersWithNotifications = await getNotificationRecipients(
    [eservice.producerId],
    "eserviceNewVersionSubmittedToDelegator",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceNewVersionSubmittedToDelegator - entityId: ${eservice.id}, eventType: EServiceDescriptorSubmittedByDelegate`
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
    notificationType: "eserviceNewVersionSubmittedToDelegator",
    entityId: producerDelegation.id,
  }));
}
