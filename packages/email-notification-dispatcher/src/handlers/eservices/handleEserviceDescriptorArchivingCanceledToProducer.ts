import {
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
import { EServiceDescriptorHandlerParams } from "../../models/handlerParams.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "eserviceStateChangedToProducer";

export async function handleEserviceDescriptorArchivingCanceledToProducer(
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
      "EServiceDescriptorArchivingCanceled"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = unsafeBrandId<DescriptorId>(descriptorIdFromEvent);
  const descriptor = retrieveDescriptor(eservice, descriptorId);

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCanceledDescriptorToProducerMailTemplate
    ),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No producer users with email notifications enabled for handleEserviceDescriptorArchivingCanceledToProducer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const subject = `La versione di un tuo e-service non è più in fase di archiviazione`;

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject,
      body: templateService.compileHtml(htmlTemplate, {
        title: subject,
        notificationType,
        entityId: `${eservice.id}/${descriptor.id}`,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        eserviceName: eservice.name,
        eserviceVersion: descriptor.version,
        ctaLabel: `Visualizza e-service`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
