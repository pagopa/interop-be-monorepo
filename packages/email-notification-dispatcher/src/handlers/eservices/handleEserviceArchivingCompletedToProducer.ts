import {
  EmailNotificationMessagePayload,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { EServiceHandlerParams } from "../handlerCommons.js";
import { config } from "../../config/config.js";
import { formatItalianDate } from "./archivingDateFormat.js";

const notificationType: NotificationType = "eserviceStateChangedToProducer";

export async function handleEserviceArchivingCompletedToProducer(
  data: EServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceArchivingCompleted"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptor = retrieveLatestDescriptor(eservice);

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCompletedEserviceToProducerMailTemplate
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
      `No producer users with email notifications enabled for handleEserviceArchivingCompletedToProducer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const archivableOn = descriptor.archivingSchedule
    ? formatItalianDate(descriptor.archivingSchedule.archivableOn)
    : undefined;
  const subject = `Archiviazione conclusa dell'e-service "${eservice.name}"`;

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
        archivableOn,
        ctaLabel: `Visualizza e-service`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
