import {
  Agreement,
  EmailNotificationMessagePayload,
  fromEServiceV2,
  generateId,
  genericError,
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
import { dateAtRomeZone } from "pagopa-interop-commons";
import { EServiceHandlerParams } from "../../models/handlerParams.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceArchivingCompletedToConsumer(
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
  if (!descriptor.archivedAt) {
    throw genericError(
      `EServiceArchivingCompleted for eservice ${eservice.id} is missing archivedAt on its latest descriptor ${descriptor.id}`
    );
  }

  const [htmlTemplate, producer, agreements] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCompletedEserviceToConsumerMailTemplate
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
    logger.info(
      `No consumer users with email notifications enabled for handleEserviceArchivingCompletedToConsumer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const archivedAt = dateAtRomeZone(descriptor.archivedAt);
  const subject = `L'e-service con cui stai scambiando dati è stato archiviato`;

  return targets.flatMap((target) => {
    const tenant = tenants.find(
      (candidate) => candidate.id === target.tenantId
    );
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
            ...(target.type === "Tenant" ? { recipientName: tenant.name } : {}),
            eserviceName: eservice.name,
            producerName: producer.name,
            archivedAt,
            ctaLabel: `Accedi a PDND`,
            selfcareId: target.selfcareId,
            bffUrl: config.bffUrl,
          }),
        },
        tenantId: target.tenantId,
        ...mapRecipientToEmailPayload(target),
      },
    ];
  });
}
