import {
  EService,
  EServiceIdDescriptorId,
  EServiceTemplateV2,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  getNotificationRecipients,
  retrieveLatestDescriptor,
} from "../handlerCommons.js";

export async function handleEserviceTemplateNameChangedToInstantiator(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
  oldName: string | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateNameUpdated"
    );
  }

  logger.info(
    `Sending in-app notification for handleEserviceTemplateNameChangedToInstantiator - entityId: ${eserviceTemplateV2Msg.id}, eventType: EServiceTemplateNameUpdated`
  );

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const eservices = await readModelService.getEServicesByTemplateId(
    eserviceTemplate.id
  );

  const instantiatorEserviceMap = eservices.reduce<
    Record<TenantId, EService[]>
  >((acc, eservice) => {
    // eslint-disable-next-line functional/immutable-data
    acc[eservice.producerId] = [...(acc[eservice.producerId] || []), eservice];
    return acc;
  }, {});

  const usersWithNotifications = await getNotificationRecipients(
    Object.keys(instantiatorEserviceMap).map((tenantId) =>
      unsafeBrandId(tenantId)
    ),
    "eserviceTemplateNameChangedToInstantiator",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleEserviceTemplateNameChangedToInstantiator - entityId: ${eserviceTemplate.id}, eventType: EServiceTemplateNameUpdated`
    );
    return [];
  }

  return usersWithNotifications.flatMap(({ userId, tenantId }) => {
    const tenantEservices = instantiatorEserviceMap[tenantId] || [];
    return tenantEservices.map((eservice) => {
      const entityId = EServiceIdDescriptorId.parse(
        `${eservice.id}/${retrieveLatestDescriptor(eservice).id}`
      );
      return {
        userId,
        tenantId,
        body: inAppTemplates.eserviceTemplateNameChangedToInstantiator(
          eserviceTemplate,
          oldName
        ),
        notificationType: "eserviceTemplateNameChangedToInstantiator",
        entityId,
      };
    });
  });
}
