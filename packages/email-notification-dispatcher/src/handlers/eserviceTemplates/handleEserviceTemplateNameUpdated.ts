import {
  EmailNotificationMessagePayload,
  EServiceId,
  fromEServiceTemplateV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
} from "../../services/utils.js";
import { EserviceTemplateNameUpdatedHandlerParams } from "../handlerCommons.js";

const notificationType: NotificationType = "templateStatusChangedToProducer";

export async function handleEServiceTemplateNameUpdated(
  params: EserviceTemplateNameUpdatedHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    oldName,
    readModelService,
    templateService,
    userService,
    correlationId,
  } = params;

  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateNameUpdated"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const [htmlTemplate, eservices] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateNameUpdatedMailTemplate
    ),
    readModelService.getEServicesByTemplateId(eserviceTemplate.id),
  ]);

  const instantiatorEserviceMap = Object.fromEntries(
    eservices.reduce<Map<TenantId, EServiceId[]>>((acc, eservice) => {
      const current = acc.get(eservice.producerId) ?? [];
      acc.set(eservice.producerId, [...current, eservice.id]);
      return acc;
    }, new Map())
  );

  const tenantIds: TenantId[] = Object.keys(instantiatorEserviceMap).map(
    (tenantId) => unsafeBrandId(tenantId)
  );

  const instantiators = await readModelService.getTenantsById(tenantIds);

  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      tenantIds,
      notificationType
    );

  const users = await userService.readUsers(
    tenantUsers.map(({ userId }) => userId)
  );

  return tenantUsers.flatMap(({ userId, tenantId }) => {
    const eserviceIds = instantiatorEserviceMap[tenantId] || [];
    const user = users.find((user) => user.userId === userId);
    const tenant = instantiators.find((tenant) => tenant.id === tenantId);

    if (!user || !tenant) {
      return [];
    }

    const address = user.email;
    return eserviceIds.map((eserviceId) => ({
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Aggiornamento nome del template "${oldName}"`,
        body: templateService.compileHtml(htmlTemplate, {
          title: `Aggiornamento nome del template "${oldName}"`,
          notificationType,
          entityId: eserviceId,
          instantiatorName: tenant.name,
          oldName: oldName ?? eserviceTemplate.id,
          newName: eserviceTemplate.name,
        }),
      },
      address,
    }));
  });
}
