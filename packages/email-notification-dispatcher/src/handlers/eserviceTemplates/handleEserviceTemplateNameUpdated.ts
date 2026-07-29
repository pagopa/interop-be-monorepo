import {
  buildEServiceInstanceName,
  EmailNotificationMessagePayload,
  EService,
  EServiceIdDescriptorId,
  fromEServiceTemplateV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { EserviceTemplateNameUpdatedHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType =
  "eserviceTemplateNameChangedToInstantiator";

export async function handleEServiceTemplateNameUpdated(
  params: EserviceTemplateNameUpdatedHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    oldName,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = params;

  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateNameUpdated"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  // Legacy events may not carry the previous name: fall back to the template id
  const oldTemplateName = oldName ?? eserviceTemplate.id;

  const [htmlTemplate, eservices] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateNameUpdatedMailTemplate
    ),
    readModelService.getEServicesByTemplateId(eserviceTemplate.id),
  ]);

  const instantiatorEserviceMap = eservices.reduce<Map<TenantId, EService[]>>(
    (acc, eservice) => {
      const current = acc.get(eservice.producerId) ?? [];
      acc.set(eservice.producerId, [...current, eservice]);
      return acc;
    },
    new Map<TenantId, EService[]>()
  );
  const tenantIds: TenantId[] = Array.from(instantiatorEserviceMap.keys());
  const instantiators = await readModelService.getTenantsById(tenantIds);

  const targets = await getRecipientsForTenants({
    tenants: instantiators,
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEServiceTemplateNameUpdated - entityId: ${eserviceTemplate.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.flatMap((t) => {
    const tenantEServices = instantiatorEserviceMap.get(t.tenantId) || [];
    const tenant = instantiators.find((tenant) => tenant.id === t.tenantId);

    if (!tenant) {
      return [];
    }

    return tenantEServices.map((eservice) => {
      /**
       * The instance rename happens asynchronously (eservice-template-instances-updater
       * -> catalogProcess.internalUpdateTemplateInstanceName), so `eservice.name` may still
       * hold the old name at this point. Both names are therefore rebuilt from the template
       * name and the instance label.
       */
      const oldEserviceName = buildEServiceInstanceName({
        templateName: oldTemplateName,
        instanceLabel: eservice.instanceLabel,
      });
      const newEserviceName = buildEServiceInstanceName({
        templateName: eserviceTemplate.name,
        instanceLabel: eservice.instanceLabel,
      });
      return {
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Aggiornamento nome del template "${oldTemplateName}"`,
          body: templateService.compileHtml(htmlTemplate, {
            title: `Aggiornamento nome del template "${oldTemplateName}"`,
            notificationType,
            entityId: EServiceIdDescriptorId.parse(
              `${eservice.id}/${retrieveLatestDescriptor(eservice).id}`
            ),
            ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
            oldName: oldEserviceName,
            newName: newEserviceName,
            selfcareId: t.selfcareId,
            bffUrl: config.bffUrl,
          }),
        },
        tenantId: t.tenantId,
        ...mapRecipientToEmailPayload(t),
      };
    });
  });
}
