import {
  EServiceTemplateIdEServiceTemplateVersionId,
  EServiceTemplateV2,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { retrieveLatestPublishedEServiceTemplateVersion } from "../handlerCommons.js";

export async function handleTemplateStatusChangedToProducer(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
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
    `Sending in-app notification for handleTemplateStatusChangedToProducer ${eserviceTemplateV2Msg.id}`
  );

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [eserviceTemplate.creatorId],
      "templateStatusChangedToProducer"
    );

  const body = inAppTemplates.templateStatusChangedToProducer(
    eserviceTemplate.name
  );
  const entityId = EServiceTemplateIdEServiceTemplateVersionId.parse(
    `${eserviceTemplate.id}/${
      retrieveLatestPublishedEServiceTemplateVersion(eserviceTemplate).id
    }`
  );
  return userNotificationConfigs.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "templateStatusChangedToProducer",
    entityId,
  }));
}
