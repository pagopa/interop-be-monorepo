import {
  EmailNotificationMessagePayload,
  EService,
  EServiceIdDescriptorId,
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
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import { EserviceTemplateHandlerParams } from "../handlerCommons.js";

const notificationType: NotificationType =
  "eserviceTemplateStatusChangedToInstantiator";

export async function handleEServiceTemplateVersionSuspendedToInstantiator(
  params: EserviceTemplateHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    readModelService,
    templateService,
    userService,
    correlationId,
  } = params;

  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionSuspended"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const [htmlTemplate, creator, eservices] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateVersionSuspendedToInstantiatorMailTemplate
    ),
    retrieveTenant(eserviceTemplate.creatorId, readModelService),
    readModelService.getEServicesByTemplateId(eserviceTemplate.id),
  ]);

  const instantiatorEserviceMap = Object.fromEntries(
    eservices.reduce<Map<TenantId, EService[]>>((acc, eservice) => {
      const current = acc.get(eservice.producerId) ?? [];
      acc.set(eservice.producerId, [...current, eservice]);
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
    const eservices = instantiatorEserviceMap[tenantId] || [];
    const user = users.find((user) => user.userId === userId);
    const tenant = instantiators.find((tenant) => tenant.id === tenantId);

    if (!user || !tenant) {
      return [];
    }

    const address = user.email;
    return eservices.map((eservice) => ({
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Sospensione del template "${eserviceTemplate.name}"`,
        body: templateService.compileHtml(htmlTemplate, {
          title: `Sospensione del template "${eserviceTemplate.name}"`,
          notificationType,
          entityId: EServiceIdDescriptorId.parse(
            `${eservice.id}/${retrieveLatestPublishedDescriptor(eservice).id}`
          ),
          instantiatorName: tenant.name,
          creatorName: creator.name,
          templateName: eserviceTemplate.name,
        }),
      },
      address,
    }));
  });
}
