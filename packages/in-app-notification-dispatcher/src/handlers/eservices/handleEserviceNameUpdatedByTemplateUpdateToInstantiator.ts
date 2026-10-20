import { Logger } from "pagopa-interop-commons";
import {
  EServiceEventV2,
  EServiceIdDescriptorId,
  fromEServiceV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
  retrieveLatestDescriptor,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

type EServiceNameUpdatedByTemplateUpdateEvent = Extract<
  EServiceEventV2,
  { type: "EServiceNameUpdatedByTemplateUpdate" }
>;

export async function handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
  msg: EServiceNameUpdatedByTemplateUpdateEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", msg.type);
  }

  const eservice = fromEServiceV2(msg.data.eservice);

  logger.info(
    `Sending in-app notification for handleEserviceNameUpdatedByTemplateUpdateToInstantiator - entityId: ${eservice.id}, eventType: ${msg.type}`
  );

  const recipients = await getNotificationRecipients(
    [eservice.producerId],
    "eserviceTemplateNameChangedToInstantiator",
    readModelService,
    logger
  );

  if (recipients.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceNameUpdatedByTemplateUpdateToInstantiator - entityId: ${eservice.id}, eventType: ${msg.type}`
    );
    return [];
  }

  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${retrieveLatestDescriptor(eservice).id}`
  );
  const body = inAppTemplates.eserviceTemplateNameChangedToInstantiator(
    msg.data.oldName ?? eservice.id,
    eservice.name
  );

  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "eserviceTemplateNameChangedToInstantiator",
    entityId,
  }));
}
