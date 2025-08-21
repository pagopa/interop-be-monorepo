import {
  EServiceId,
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
import { retrieveTenant } from "../handlerCommons.js";

export async function handleEserviceTemplateNameChangedToInstantiator(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
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
    `Sending in-app notification for handleEserviceTemplateNameChangedToInstantiator ${eserviceTemplateV2Msg.id}`
  );

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const eservices = await readModelService.getEServicesByTemplateId(
    eserviceTemplate.id
  );

  const instantiatorEserviceMap = eservices.reduce<
    Record<TenantId, EServiceId[]>
  >((acc, eservice) => {
    // eslint-disable-next-line functional/immutable-data
    acc[eservice.producerId] = [
      ...(acc[eservice.producerId] || []),
      eservice.id,
    ];
    return acc;
  }, {});

  const userNotificationConfigs =
    await readModelService.getTenantUsersWithNotificationEnabled(
      Object.keys(instantiatorEserviceMap).map((tenantId) =>
        unsafeBrandId(tenantId)
      ),
      "eserviceTemplateNameChangedToInstantiator"
    );

  const creator = await retrieveTenant(
    eserviceTemplate.creatorId,
    readModelService
  );

  if (!userNotificationConfigs) {
    logger.info(
      `No user notification configs found for handleEserviceTemplateNameChangedToInstantiator ${eserviceTemplate.id}`
    );
    return [];
  }

  return userNotificationConfigs.flatMap(({ userId, tenantId }) => {
    const tenantEserviceIds = instantiatorEserviceMap[tenantId] || [];
    return tenantEserviceIds.map((eserviceId) => ({
      userId,
      tenantId,
      body: inAppTemplates.eserviceTemplateNameChangedToInstantiator(
        creator.name,
        eserviceTemplate.name
      ),
      notificationType: "eserviceTemplateNameChangedToInstantiator",
      entityId: eserviceId,
    }));
  });
}
