import {
  EmailNotificationMessagePayload,
  EServiceIdDescriptorId,
  generateId,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  ProducerKeychainEServiceHandlerParams,
} from "../handlerCommons.js";
import { eServiceNotFound } from "../../models/errors.js";

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleProducerKeychainEserviceAdded(
  data: ProducerKeychainEServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceId,
    readModelService,
    logger,
    templateService,
    userService,
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
    retrieveLatestPublishedDescriptor(eservice),
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
    userService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found. Eservice ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
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
      }),
    },
    address,
  }));
}
