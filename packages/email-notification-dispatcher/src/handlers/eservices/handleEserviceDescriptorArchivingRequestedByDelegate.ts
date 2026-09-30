import {
  DescriptorId,
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
  retrieveDescriptor,
  retrieveHTMLTemplate,
  retrieveProducerDelegation,
  retrieveTenant,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { EServiceDescriptorHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType =
  "eserviceArchivingRequestedToDelegator";

export async function handleEserviceDescriptorArchivingRequestedByDelegate(
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
      "EServiceDescriptorArchivingRequestedByDelegate"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  const descriptorId = unsafeBrandId<DescriptorId>(descriptorIdFromEvent);
  const descriptor = retrieveDescriptor(eservice, descriptorId);

  const [htmlTemplate, delegation] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorArchivingRequestedByDelegateMailTemplate
    ),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [delegator, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [delegator],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEserviceDescriptorArchivingRequestedByDelegate - entityId: ${eservice.id}/${descriptor.id}, eventType: ${notificationType}`
    );
    return [];
  }

  const subject = `Nuova richiesta di archiviazione di una versione di un e-service`;

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject,
      body: templateService.compileHtml(htmlTemplate, {
        title: subject,
        notificationType,
        entityId: `${eservice.id}/${descriptor.id}`,
        ...(t.type === "Tenant" ? { recipientName: delegator.name } : {}),
        delegateName: delegate.name,
        eserviceName: eservice.name,
        eserviceVersion: descriptor.version,
        ctaLabel: "Visualizza l'e-service",
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
