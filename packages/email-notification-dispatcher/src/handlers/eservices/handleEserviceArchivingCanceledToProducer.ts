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
import { EServiceHandlerParams } from "../../models/handlerParams.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "eserviceStateChangedToProducer";

export async function handleEserviceArchivingCanceledToProducer(
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
    throw missingKafkaMessageDataError("eservice", "EServiceArchivingCanceled");
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptor = retrieveLatestDescriptor(eservice);

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCanceledEserviceToProducerMailTemplate
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
      `No producer users with email notifications enabled for handleEserviceArchivingCanceledToProducer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const subject = `Un tuo e-service non è più in fase di archiviazione`;

  return targets.map((target) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject,
      body: templateService.compileHtml(htmlTemplate, {
        title: subject,
        notificationType,
        entityId: `${eservice.id}/${descriptor.id}`,
        ...(target.type === "Tenant" ? { recipientName: producer.name } : {}),
        eserviceName: eservice.name,
        ctaLabel: `Accedi a PDND`,
        selfcareId: target.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: target.tenantId,
    ...mapRecipientToEmailPayload(target),
  }));
}
