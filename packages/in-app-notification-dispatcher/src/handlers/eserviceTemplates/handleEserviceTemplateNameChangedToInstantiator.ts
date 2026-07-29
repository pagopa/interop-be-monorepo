import { Logger } from "pagopa-interop-commons";
import {
  buildEServiceInstanceName,
  EService,
  EServiceIdDescriptorId,
  EServiceTemplateV2,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { NewNotification } from "pagopa-interop-models";
import {
  inAppTemplates,
  getNotificationRecipients,
  retrieveLatestDescriptor,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

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
      /**
       * The instance rename happens asynchronously (eservice-template-instances-updater
       * -> catalogProcess.internalUpdateTemplateInstanceName), so `eservice.name` may still
       * hold the old name at this point. Both names are therefore rebuilt from the template
       * name and the instance label.
       */
      const oldEserviceName = buildEServiceInstanceName({
        templateName: oldName ?? eserviceTemplate.id,
        instanceLabel: eservice.instanceLabel,
      });
      const newEserviceName = buildEServiceInstanceName({
        templateName: eserviceTemplate.name,
        instanceLabel: eservice.instanceLabel,
      });
      return {
        userId,
        tenantId,
        body: inAppTemplates.eserviceTemplateNameChangedToInstantiator(
          oldEserviceName,
          newEserviceName
        ),
        notificationType: "eserviceTemplateNameChangedToInstantiator",
        entityId,
      };
    });
  });
}
