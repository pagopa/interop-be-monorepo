import {
  DescriptorId,
  fromEServiceV2,
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  EServiceDescriptorHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";
import { descriptorNotFound } from "../../models/errors.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceDescriptorPublished(
  data: EServiceDescriptorHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    descriptorId: descriptorIdFromEvent,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorPublished"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = unsafeBrandId<DescriptorId>(descriptorIdFromEvent);
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);

  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  const [htmlTemplate, agreements, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorPublishedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  if (!agreements || agreements.length === 0) {
    logger.warn(
      `Agreement not found for eservice ${eservice.id}, skipping email`
    );
    return [];
  }

  const tenants = await readModelService.getTenantsById(
    agreements.map((agreement) => agreement.consumerId)
  );

  const targets = await getRecipientsForTenants({
    tenants,
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEserviceDescriptorPublished - entityId: ${eservice.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.flatMap((t) => {
    const tenant = tenants.find((tenant) => tenant.id === t.tenantId);

    if (!tenant) {
      return [];
    }

    return [
      {
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Nuova versione disponibile per "${eservice.name}"`,
          body: templateService.compileHtml(htmlTemplate, {
            title: `Nuova versione disponibile per "${eservice.name}"`,
            notificationType,
            entityId: `${eservice.id}/${descriptor.id}`,
            ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
            eserviceName: eservice.name,
            eserviceVersion: descriptor.version,
            producerName: producer.name,
            ctaLabel: `Visualizza e-service`,
            selfcareId: t.selfcareId,
            bffUrl: config.bffUrl,
          }),
        },
        tenantId: t.tenantId,
        ...mapRecipientToEmailPayload(t),
      },
    ];
  });
}
