import { Logger } from "pagopa-interop-commons";
import {
  EServiceId,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  NewNotification,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { EServiceTemplateV2 } from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { retrieveEservice, retrieveTenant } from "../handlerCommons.js";

export async function handleNewEserviceTemplateVersionToInstantiator(
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
    `Sending in-app notification for handleNewEserviceTemplateVersionToInstantiator ${eserviceTemplateV2Msg.id}`
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
      "newEserviceTemplateVersionToInstantiator"
    );

  if (!userNotificationConfigs) {
    logger.info(
      `No user notification configs found for handleNewEserviceTemplateVersionToInstantiator ${eserviceTemplate.id}`
    );
    return [];
  }

  const creator = await retrieveTenant(
    eserviceTemplate.creatorId,
    readModelService
  );

  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (version) => version.id === eserviceTemplateVersionId
  );

  const notificationPromises = userNotificationConfigs.map(
    async ({ userId, tenantId }) => {
      const tenantEserviceIds = instantiatorEserviceMap[tenantId] || [];
      const eservicePromises = tenantEserviceIds.map((eserviceId) =>
        retrieveEservice(eserviceId, readModelService)
      );
      const eservices = await Promise.all(eservicePromises);
      return eservices.map((eservice) => ({
        userId,
        tenantId,
        body: inAppTemplates.newEserviceTemplateVersionToInstantiator(
          creator.name,
          eserviceTemplateVersion?.version
            ? eserviceTemplateVersion.version.toString()
            : "",
          eserviceTemplate.name,
          eservice.name
        ),
        notificationType: "newEserviceTemplateVersionToInstantiator" as const,
        entityId: eservice.id,
      }));
    }
  );

  const notificationsArrays = await Promise.all(notificationPromises);
  return notificationsArrays.flat();
}
