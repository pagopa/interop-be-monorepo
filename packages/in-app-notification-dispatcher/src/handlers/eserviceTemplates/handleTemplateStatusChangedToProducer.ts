import { Logger } from "pagopa-interop-commons";
import {
  EServiceTemplateIdEServiceTemplateVersionId,
  EServiceTemplateV2,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import {
  inAppTemplates,
  getNotificationRecipients,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleTemplateStatusChangedToProducer(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
  eserviceTemplateVersionId: string,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionSuspended"
    );
  }

  logger.info(
    `Sending in-app notification for handleTemplateStatusChangedToProducer - entityId: ${eserviceTemplateV2Msg.id}, eventType: EServiceTemplateVersionSuspended`
  );

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [eserviceTemplate.creatorId],
    "templateStatusChangedToProducer",
    readModelService,
    logger
  );
  const body = inAppTemplates.templateStatusChangedToProducer(
    eserviceTemplate.name
  );

  const entityId = EServiceTemplateIdEServiceTemplateVersionId.parse(
    `${eserviceTemplate.id}/${eserviceTemplateVersionId}`
  );
  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "templateStatusChangedToProducer",
    entityId,
  }));
}
