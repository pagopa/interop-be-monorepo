import { Logger } from "pagopa-interop-commons";
import {
  EService,
  EServiceIdDescriptorId,
  fromEServiceTemplateV2,
  missingKafkaMessageDataError,
  NewNotification,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { EServiceTemplateV2 } from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  retrieveLatestDescriptor,
  getNotificationRecipients,
  retrieveTenant,
} from "../handlerCommons.js";

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
    `Sending in-app notification for handleNewEserviceTemplateVersionToInstantiator - entityId: ${eserviceTemplateV2Msg.id}, eventType: EServiceTemplateVersionPublished`
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
    "newEserviceTemplateVersionToInstantiator",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleNewEserviceTemplateVersionToInstantiator - entityId: ${eserviceTemplate.id}, eventType: EServiceTemplateVersionPublished`
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

  return usersWithNotifications.flatMap(({ userId, tenantId }) => {
    const tenantEservices = instantiatorEserviceMap[tenantId] || [];
    return tenantEservices.map((eservice) => {
      const descriptor =
        eservice.descriptors.find(
          (d) => d.templateVersionRef?.id === eserviceTemplateVersionId
        ) || retrieveLatestDescriptor(eservice);
      const entityId = EServiceIdDescriptorId.parse(
        `${eservice.id}/${descriptor?.id}`
      );
      return {
        userId,
        tenantId,
        body: inAppTemplates.newEserviceTemplateVersionToInstantiator(
          creator.name,
          eserviceTemplateVersion?.version
            ? eserviceTemplateVersion.version.toString()
            : "",
          eserviceTemplate.name
        ),
        notificationType: "newEserviceTemplateVersionToInstantiator",
        entityId,
      };
    });
  });
}
