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
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../handlerCommons.js";

export async function handleEserviceTemplateStatusChangedToInstantiator(
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
    `Sending in-app notification for handleEserviceTemplateStatusChangedToInstantiator ${eserviceTemplateV2Msg.id}`
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

  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      Object.keys(instantiatorEserviceMap).map((tenantId) =>
        unsafeBrandId(tenantId)
      ),
      "eserviceTemplateStatusChangedToInstantiator"
    );
  if (!userNotificationConfigs) {
    logger.info(
      `No user notification configs found for handleEserviceTemplateStatusChangedToInstantiator ${eserviceTemplate.id}`
    );
    return [];
  }

  const creator = await retrieveTenant(
    eserviceTemplate.creatorId,
    readModelService
  );

  return userNotificationConfigs.flatMap(({ userId, tenantId }) => {
    const tenantEservices = instantiatorEserviceMap[tenantId] || [];
    return tenantEservices.map((eservice) => {
      const entityId = EServiceIdDescriptorId.parse(
        `${eservice.id}/${retrieveLatestPublishedDescriptor(eservice).id}`
      );
      return {
        userId,
        tenantId,
        body: inAppTemplates.eserviceTemplateStatusChangedToInstantiator(
          creator.name,
          eserviceTemplate.name
        ),
        notificationType: "eserviceTemplateStatusChangedToInstantiator",
        entityId,
      };
    });
  });
}
