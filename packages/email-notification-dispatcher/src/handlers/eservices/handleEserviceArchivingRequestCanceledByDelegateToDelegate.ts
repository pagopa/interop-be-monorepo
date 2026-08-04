import {
  EmailNotificationMessagePayload,
  NotificationType,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  retrieveProducerDelegation,
  retrieveTenant,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { EServiceHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType =
  "eserviceArchivingRequestedToDelegator";

export async function handleEServiceArchivingRequestCanceledByDelegateToDelegate(
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
      "EServiceArchivingRequestCanceledByDelegate"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = retrieveLatestDescriptor(eservice).id;

  const [htmlTemplate, delegation] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingRequestCanceledByDelegateToDelegateMailTemplate
    ),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [producer, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [delegate],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEServiceArchivingRequestCanceledByDelegateToDelegate - entityId: ${eservice.id}, eventType: ${notificationType}`
    );
    return [];
  }

  const subject = `Annullamento richiesta di archiviazione`;

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject,
      body: templateService.compileHtml(htmlTemplate, {
        title: subject,
        notificationType,
        entityId: `${eservice.id}/${descriptorId}`,
        ...(t.type === "Tenant" ? { recipientName: delegate.name } : {}),
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: "Accedi a PDND",
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
