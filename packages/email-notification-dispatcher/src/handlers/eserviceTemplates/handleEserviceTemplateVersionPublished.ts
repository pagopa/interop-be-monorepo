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
import {
  EserviceTemplateHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "newEserviceTemplateVersionToInstantiator";

export async function handleEServiceTemplateVersionPublished(
  params: EserviceTemplateHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    eserviceTemplateVersionId,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = params;

  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionPublished"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (version) => version.id === eserviceTemplateVersionId
  );

  if (!eserviceTemplateVersion) {
    logger.error(
      `No version find in eservice template ${eserviceTemplate.id} with id ${eserviceTemplateVersionId}`
    );
    return [];
  }

  const [htmlTemplate, creator, eservices] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateVersionPublishedMailTemplate
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

  const instantiators = await readModelService.getTenantsById(
    Object.keys(instantiatorEserviceMap).map((tenantId) =>
      unsafeBrandId(tenantId)
    )
  );

  const targets = await getRecipientsForTenants({
    tenants: instantiators,
    notificationType,
    readModelService,
    userService,
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
    const tenantEServices = instantiatorEserviceMap[t.tenantId] || [];
    const tenant = instantiators.find((tenant) => tenant.id === t.tenantId);

    if (!tenant) {
      return [];
    }

    return tenantEServices.map((eservice) => ({
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Nuova versione del template "${eserviceTemplate.name}"`,
        body: templateService.compileHtml(htmlTemplate, {
          title: `Nuova versione del template "${eserviceTemplate.name}"`,
          notificationType,
          entityId: EServiceIdDescriptorId.parse(
            `${eservice.id}/${retrieveLatestPublishedDescriptor(eservice).id}`
          ),
          ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
          creatorName: creator.name,
          version: eserviceTemplateVersion.version,
          templateName: eserviceTemplate.name,
        }),
      },
      tenantId: t.tenantId,
      ...mapRecipientToEmailPayload(t),
    }));
  });
}
