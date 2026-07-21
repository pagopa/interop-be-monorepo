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

import { config } from "../../config/config.js";
import { EServiceDescriptorHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType = "eserviceStateChangedToProducer";

export async function handleEserviceDescriptorArchivingCompletedToProducer(
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

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCompletedDescriptorToProducerMailTemplate
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
      `No producer users with email notifications enabled for handleEserviceDescriptorArchivingCompletedToProducer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const subject = `La versione di un tuo e-service è stata archiviata`;

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
