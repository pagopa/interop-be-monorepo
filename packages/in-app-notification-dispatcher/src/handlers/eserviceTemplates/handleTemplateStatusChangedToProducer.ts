import {
  EServiceTemplateV2,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { getNotificationRecipients } from "../handlerCommons.js";

export async function handleTemplateStatusChangedToProducer(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userServiceSQL: UserServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionSuspended"
    );
  }

  logger.info(
    `Sending in-app notification for handleTemplateStatusChangedToProducer ${eserviceTemplateV2Msg.id}`
  );

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [eserviceTemplate.creatorId],
    "templateStatusChangedToProducer",
    readModelService,
    userServiceSQL
  );

  const body = inAppTemplates.templateStatusChangedToProducer(
    eserviceTemplate.name
  );
  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "templateStatusChangedToProducer",
    entityId: eserviceTemplate.id,
  }));
}
