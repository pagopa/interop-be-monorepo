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
import {
  getNotificationRecipients,
  retrieveTenant,
} from "../handlerCommons.js";

export async function handleEserviceTemplateStatusChangedToInstantiator(
  eserviceTemplateV2Msg: EServiceTemplateV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
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
    "eserviceTemplateStatusChangedToInstantiator",
    readModelService,
    userService
  );
  if (!usersWithNotifications) {
    logger.info(
      `No user notification configs found for handleEserviceTemplateStatusChangedToInstantiator ${eserviceTemplate.id}`
    );
    return [];
  }

  const creator = await retrieveTenant(
    eserviceTemplate.creatorId,
    readModelService
  );

  return usersWithNotifications.flatMap(({ userId, tenantId }) => {
    const tenantEserviceIds = instantiatorEserviceMap[tenantId] || [];
    return tenantEserviceIds.map((eserviceId) => ({
      userId,
      tenantId,
      body: inAppTemplates.eserviceTemplateStatusChangedToInstantiator(
        creator.name,
        eserviceTemplate.name
      ),
      notificationType: "eserviceTemplateStatusChangedToInstantiator",
      entityId: eserviceId,
    }));
  });
}
