import {
  EServiceTemplateIdEServiceTemplateVersionId,
  EServiceTemplateV2,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  inAppTemplates,
  getNotificationRecipients,
} from "pagopa-interop-notification-commons";

export async function handleNewEserviceTemplateVersionToProducer(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
  eserviceTemplateVersionId: string,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionPublished"
    );
  }

  logger.info(
    `Sending in-app notification for handleNewEserviceTemplateVersionToProducer - entityId: ${eserviceTemplateV2Msg.id}, eventType: EServiceTemplateVersionPublished`
  );

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [eserviceTemplate.creatorId],
    "templateStatusChangedToProducer",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleNewEserviceTemplateVersionToProducer - entityId: ${eserviceTemplate.id}, eventType: EServiceTemplateVersionPublished`
    );
    return [];
  }

  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (version) => version.id === eserviceTemplateVersionId
  );

  const body = inAppTemplates.newEserviceTemplateVersionToProducer(
    eserviceTemplateVersion?.version
      ? eserviceTemplateVersion.version.toString()
      : "",
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
