import {
  Agreement,
  DescriptorId,
  EmailNotificationMessagePayload,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveDescriptor,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { EServiceDescriptorHandlerParams } from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceDescriptorArchivingCompletedToConsumer(
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
      "EServiceDescriptorArchivingCompleted"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = unsafeBrandId<DescriptorId>(descriptorIdFromEvent);
  const descriptor = retrieveDescriptor(eservice, descriptorId);

  const [htmlTemplate, producer, agreements] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCompletedDescriptorToConsumerMailTemplate
    ),
    retrieveTenant(eservice.producerId, readModelService),
    readModelService.getAgreementsByEserviceId(eservice.id),
  ]);

  if (!agreements || agreements.length === 0) {
    return [];
  }

  const tenants = await readModelService.getTenantsById(
    agreements.map((a: Agreement) => a.consumerId)
  );

  const targets = await getRecipientsForTenants({
    tenants,
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    return [];
  }

  const subject = `Archiviazione conclusa per la versione ${descriptor.version} dell'e-service "${eservice.name}"`;

  return targets.flatMap((t) => {
    const tenant = tenants.find((x) => x.id === t.tenantId);
    if (!tenant) {
      return [];
    }
    return [
      {
        correlationId: correlationId ?? generateId(),
        email: {
          subject,
          body: templateService.compileHtml(htmlTemplate, {
            title: subject,
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
