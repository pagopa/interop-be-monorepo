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
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { getNotificationRecipients } from "../handlerCommons.js";

export async function handleEserviceTemplateNameChangedToInstantiator(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
  oldName: string | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
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

  const usersWithNotifications = await getNotificationRecipients(
    Object.keys(instantiatorEserviceMap).map((tenantId) =>
      unsafeBrandId(tenantId)
    ),
    "eserviceTemplateNameChangedToInstantiator",
    readModelService,
    userService,
    logger
  );

  if (!usersWithNotifications) {
    logger.info(
      `No user notification configs found for handleEserviceTemplateNameChangedToInstantiator ${eserviceTemplate.id}`
    );
    return [];
  }

  return usersWithNotifications.flatMap(({ userId, tenantId }) => {
    const tenantEserviceIds = instantiatorEserviceMap[tenantId] || [];
    return tenantEserviceIds.map((eserviceId) => ({
      userId,
      tenantId,
      body: inAppTemplates.eserviceTemplateNameChangedToInstantiator(
        eserviceTemplate,
        oldName
      ),
      notificationType: "eserviceTemplateNameChangedToInstantiator",
      entityId: eserviceId,
    }));
  });
}
