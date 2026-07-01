import {
  DescriptorId,
  fromEServiceV2,
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  unsafeBrandId,
  archivingScope,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  descriptorNotFound,
} from "pagopa-interop-notification-commons";
import { EServiceDescriptorHandlerParams } from "../../models/handlerParams.js";

import { config } from "../../config/config.js";
import { dateAtRomeZone } from "pagopa-interop-commons";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceDescriptorActivatedToConsumer(
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
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);

  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  const archivingSchedule = descriptor.archivingSchedule;

  const [htmlTemplate, agreements, producer] = await Promise.all([
    retrieveHTMLTemplate(
      archivingSchedule
        ? eventMailTemplateType.eserviceArchivingDescriptorActivatedToConsumerMailTemplate
        : eventMailTemplateType.eserviceDescriptorActivatedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
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
      `No users with email notifications enabled for handleEserviceDescriptorActivatedToConsumer - entityId: ${eservice.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.flatMap((t) => {
    const tenant = tenants.find((tenant) => tenant.id === t.tenantId);

    if (!tenant) {
      return [];
    }

    return [
      {
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Una versione di "${eservice.name}" è stata riattivata`,
          body: templateService.compileHtml(htmlTemplate, {
            title: `Una versione di "${eservice.name}" è stata riattivata`,
            notificationType,
            ...(archivingSchedule
              ? {
                  archivableOn: dateAtRomeZone(archivingSchedule.archivableOn),
                  newerVersionAvailable:
                    archivingSchedule.scope === archivingScope.descriptor,
                }
              : {}),
            entityId: `${eservice.id}/${descriptor.id}`,
            ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
            producerName: producer.name,
            eserviceName: eservice.name,
            eserviceVersion: descriptor.version,
            ctaLabel: `Accedi a PDND`,
            selfcareId: t.selfcareId,
            bffUrl: config.bffUrl,
          }),
        },
        tenantId: t.tenantId,
        ...mapRecipientToEmailPayload(t),
      },
    ];
  });
}
