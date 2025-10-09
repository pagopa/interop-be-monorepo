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
} from "../../services/utils.js";
import {
  EserviceTemplateNameUpdatedHandlerParams,
  getRecipientsForTenants,
  UserEmailNotificationRecipient,
} from "../handlerCommons.js";

const notificationType: NotificationType = "templateStatusChangedToProducer";

export async function handleEServiceTemplateNameUpdated(
  params: EserviceTemplateNameUpdatedHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    oldName,
    readModelService,
    logger,
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
    eservices.reduce<Map<TenantId, EService[]>>((acc, eservice) => {
      const current = acc.get(eservice.producerId) ?? [];
      acc.set(eservice.producerId, [...current, eservice]);
      return acc;
    }, new Map())
  );

  const instantiators = await readModelService.getTenantsById(
    Object.keys(instantiatorEserviceMap).map((tenantId) =>
      unsafeBrandId(tenantId)
    )
  );

  const targets = (
    await getRecipientsForTenants({
      tenants: instantiators,
      notificationType,
      readModelService,
      userService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter(
    (target): target is UserEmailNotificationRecipient => target.type === "User"
  );

  if (targets.length === 0) {
    logger.info(
      `No targets found for instantiator tenants. EService template ${eserviceTemplate.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.flatMap(({ address, tenantId }) => {
    const tenantEServices = instantiatorEserviceMap[tenantId] || [];
    const tenant = instantiators.find((tenant) => tenant.id === tenantId);

    if (!tenant) {
      return [];
    }

    return tenantEServices.map((eservice) => ({
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Aggiornamento nome del template "${oldName}"`,
        body: templateService.compileHtml(htmlTemplate, {
          title: `Aggiornamento nome del template "${oldName}"`,
          notificationType,
          entityId: EServiceIdDescriptorId.parse(
            `${eservice.id}/${retrieveLatestPublishedDescriptor(eservice).id}`
          ),
          instantiatorName: tenant.name,
          oldName: oldName ?? eserviceTemplate.id,
          newName: eserviceTemplate.name,
        }),
      },
      address,
    }));
  });
}
