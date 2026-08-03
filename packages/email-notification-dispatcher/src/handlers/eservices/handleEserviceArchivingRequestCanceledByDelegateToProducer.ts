import { dateAtRomeZone } from "pagopa-interop-commons";
import {
  DescriptorId,
  EService,
  EmailNotificationMessagePayload,
  NotificationType,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
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
import { EServiceDescriptorDelegateArchiveCanceledHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType =
  "eserviceArchivingRequestedToDelegator";

function getDescriptorIdFromEvent(
  data: EServiceDescriptorDelegateArchiveCanceledHandlerParams,
  eservice: EService
): DescriptorId {
  if ("descriptorId" in data && data.descriptorId) {
    return unsafeBrandId<DescriptorId>(data.descriptorId);
  }
  return retrieveLatestDescriptor(eservice).id;
}

export async function handleEServiceArchivingRequestCanceledByDelegateToProducer(
  data: EServiceDescriptorDelegateArchiveCanceledHandlerParams
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
  const descriptorId = getDescriptorIdFromEvent(data, eservice);

  const [htmlTemplate, delegation] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceArchivingRequestCanceledByDelegateToProducerMailTemplate
    ),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [producer, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEServiceArchivingRequestCanceledByDelegateToProducer - entityId: ${eservice.id}, eventType: ${notificationType}`
    );
    return [];
  }

  const subject = `Annullamento richiesta di archiviazione`;

  const requestedOn = dateAtRomeZone(data.requestedOn);

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject,
      body: templateService.compileHtml(htmlTemplate, {
        title: subject,
        notificationType,
        entityId: `${eservice.id}/${descriptorId}`,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        delegateName: delegate.name,
        requestedOn,
        ctaLabel: "Accedi a PDND",
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
