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
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  ProducerKeychainEServiceHandlerParams,
} from "../handlerCommons.js";
import { eServiceNotFound } from "../../models/errors.js";
import { config } from "../../config/config.js";

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
    throw eServiceNotFound(eserviceId);
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
      `No targets found. Eservice ${eservice.id}, no emails to dispatch.`
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
        tenantId: t.tenantId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
