import {
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
  retrieveTenant,
} from "../../services/utils.js";
import {
  EserviceTemplateHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "eserviceTemplateStatusChangedToInstantiator";

export async function handleEServiceTemplateVersionSuspendedToInstantiator(
  params: EserviceTemplateHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    eserviceTemplateVersionId,
    readModelService,
    logger,
    templateService,
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
      `No targets found for instantiator tenants. EService template ${eserviceTemplate.id}, eservice template version ${eserviceTemplateVersionId}, no emails to dispatch.`
    );
    return [];
  }

  return targets.flatMap((t) => {
    const eservices = instantiatorEserviceMap.get(t.tenantId) || [];
    const tenant = instantiators.find((tenant) => tenant.id === t.tenantId);

    if (!tenant) {
      return [];
    }

    return eservices.map((eservice) => {
      const descriptor =
        eservice.descriptors.find(
          (d) => d.templateVersionRef?.id === eserviceTemplateVersionId
        ) || retrieveLatestDescriptor(eservice);
      return {
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Sospensione del template "${eserviceTemplate.name}"`,
          body: templateService.compileHtml(htmlTemplate, {
            title: `Sospensione del template "${eserviceTemplate.name}"`,
            notificationType,
            entityId: EServiceIdDescriptorId.parse(
              `${eservice.id}/${descriptor.id}`
            ),
            ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
            creatorName: creator.name,
            templateName: eserviceTemplate.name,
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
