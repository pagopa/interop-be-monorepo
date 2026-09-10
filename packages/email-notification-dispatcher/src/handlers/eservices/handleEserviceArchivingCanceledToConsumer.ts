import {
  Agreement,
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
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { EServiceHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceArchivingCanceledToConsumer(
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

  const [htmlTemplate, agreements] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingCanceledEserviceToConsumerMailTemplate
    ),
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
      `No consumer users with email notifications enabled for handleEserviceArchivingCanceledToConsumer - entityId: ${eservice.id}/${descriptor.id}`
    );
    return [];
  }

  const subject = `Un e-service con cui stai scambiando dati non è più in fase di archiviazione`;

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
