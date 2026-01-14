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
  retrieveLatestDescriptor,
  getNotificationRecipients,
} from "../handlerCommons.js";

export async function handleEserviceTemplateStatusChangedToInstantiator(
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
    `Sending in-app notification for handleEserviceTemplateStatusChangedToInstantiator ${eserviceTemplateV2Msg.id}/${eserviceTemplateVersionId}`
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
    "eserviceTemplateStatusChangedToInstantiator",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No user notification configs found for handleEserviceTemplateStatusChangedToInstantiator ${eserviceTemplate.id}/${eserviceTemplateVersionId}`
    );
    return [];
  }

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
        body: inAppTemplates.eserviceTemplateStatusChangedToInstantiator(
          eserviceTemplate.name
        ),
        notificationType: "eserviceTemplateStatusChangedToInstantiator",
        entityId,
      };
    });
  });
}
