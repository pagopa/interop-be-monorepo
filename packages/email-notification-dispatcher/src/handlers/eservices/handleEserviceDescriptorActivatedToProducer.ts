import {
  archivingScope,
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
import { dateAtRomeZone } from "pagopa-interop-commons";

const notificationType: NotificationType = "eserviceStateChangedToProducer";

export async function handleEserviceDescriptorActivatedToProducer(
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
      "EServiceDescriptorActivated"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = unsafeBrandId<DescriptorId>(descriptorIdFromEvent);
  const descriptor = retrieveDescriptor(eservice, descriptorId);

  const archivingSchedule = descriptor.archivingSchedule;

  if (!archivingSchedule) {
    logger.info(
      `Archiving schedule not found for eservice ${eservice.id}, skipping email`
    );
    return [];
  }

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingDescriptorActivatedToProducerMailTemplate
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
      `No producer users with email notifications enabled for handleEserviceDescriptorActivatedToProducer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Una versione di "${eservice.name}" è stata riattivata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Una versione di "${eservice.name}" è stata riattivata`,
        notificationType,
        archivableOn: dateAtRomeZone(archivingSchedule.archivableOn),
        isEserviceArchiving:
          archivingSchedule.scope === archivingScope.eservice,
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
