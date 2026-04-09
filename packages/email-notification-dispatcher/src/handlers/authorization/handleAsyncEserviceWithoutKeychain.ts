import {
  EmailNotificationMessagePayload,
  EServiceIdDescriptorId,
  generateId,
  NotificationType,
  ProducerKeychainId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  ProducerKeychainEServiceHandlerParams,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "producerKeychainKeyAddedDeletedToClientUsers";

export async function handleAsyncEserviceWithoutKeychain(
  data: ProducerKeychainEServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceId,
    producerKeychainV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  const eservice = await retrieveEService(eserviceId, readModelService);

  if (!eservice.asyncExchange) {
    logger.info(
      `Eservice ${eserviceId} is not async, skipping email notification for ProducerKeychainEServiceRemoved`
    );
    return [];
  }

  if (!producerKeychainV2Msg) {
    logger.warn(
      `ProducerKeychain data not available in event, skipping email notification`
    );
    return [];
  }

  const eserviceInOtherKeychain =
    await readModelService.eserviceExistsInOtherProducerKeychains(
      eserviceId,
      eservice.producerId,
      unsafeBrandId<ProducerKeychainId>(producerKeychainV2Msg.id)
    );

  if (eserviceInOtherKeychain) {
    logger.info(
      `Eservice ${eserviceId} still exists in other producer keychains for producer ${eservice.producerId}, skipping email notification`
    );
    return [];
  }

  const [htmlTemplate, descriptor, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.asyncEserviceWithoutKeychainMailTemplate
    ),
    retrieveLatestDescriptor(eservice),
    retrieveTenant(eservice.producerId, readModelService),
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
      `No targets found. Eservice ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Attenzione: e-service asincrono "${eservice.name}" senza portachiavi`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Attenzione: e-service asincrono senza portachiavi`,
        notificationType,
        entityId: EServiceIdDescriptorId.parse(
          `${eservice.id}/${descriptor.id}`
        ),
        eserviceName: eservice.name,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        ctaLabel: `Visualizza e-service`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
