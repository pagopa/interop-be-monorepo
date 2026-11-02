import {
  EmailNotificationMessagePayload,
  EServiceIdDescriptorId,
  generateId,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  retrieveTenant,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  eserviceNotFound,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { ProducerKeychainEServiceHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleProducerKeychainEserviceAdded(
  data: ProducerKeychainEServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceId,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  const eservice = await readModelService.getEServiceById(eserviceId);

  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }

  const [htmlTemplate, agreements, descriptor, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainEserviceAddedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveLatestDescriptor(eservice),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  if (!agreements || agreements.length === 0) {
    logger.warn(
      `Agreement not found for eservice ${eservice.id}, skipping email`
    );
    return [];
  }

  const tenants = await readModelService.getTenantsById(
    agreements.map((agreement) => agreement.consumerId)
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
      `No users with email notifications enabled for handleProducerKeychainEserviceAdded - entityId: ${eservice.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Nuovo livello di sicurezza per "${eservice.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Nuovo livello di sicurezza per "${eservice.name}"`,
        notificationType,
        entityId: EServiceIdDescriptorId.parse(
          `${eservice.id}/${descriptor.id}`
        ),
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza chiavi`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
