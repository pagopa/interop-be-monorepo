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
import { dateAtRomeZone } from "pagopa-interop-commons";

const notificationType: NotificationType = "eserviceStateChangedToProducer";

export async function handleEserviceDescriptorArchivedToProducer(
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
      "EServiceDescriptorArchived"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = unsafeBrandId<DescriptorId>(descriptorIdFromEvent);
  const descriptor = retrieveDescriptor(eservice, descriptorId);

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingDescriptorArchivedToProducerMailTemplate
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
      `No producer users with email notifications enabled for handleEserviceDescriptorArchivedToProducer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const archivingDate = dateAtRomeZone(new Date());
  const subject = `La versione ${descriptor.version} dell'e-service "${eservice.name}" è stata archiviata il giorno ${archivingDate} perché senza fruitori. Da ora non è più attiva.`;

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
        archivingDate,
        ctaLabel: `Accedi a PDND`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
