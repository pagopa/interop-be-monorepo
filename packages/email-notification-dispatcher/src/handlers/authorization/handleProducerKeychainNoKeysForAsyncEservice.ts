import {
  EmailNotificationMessagePayload,
  fromProducerKeychainV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  ProducerKeychainKeyHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "producerKeychainKeyAddedDeletedToClientUsers";

export async function handleProducerKeychainNoKeysForAsyncEservice(
  data: ProducerKeychainKeyHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    producerKeychainV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!producerKeychainV2Msg) {
    throw missingKafkaMessageDataError(
      "producerKeychain",
      "ProducerKeychainKeyDeleted"
    );
  }

  const producerKeychain = fromProducerKeychainV2(producerKeychainV2Msg);

  if (producerKeychain.keys.length > 0) {
    logger.info(
      `ProducerKeychain ${producerKeychain.id} still has keys, skipping no-keys-for-async-eservice email notification`
    );
    return [];
  }

  const asyncEserviceNames: string[] = [];
  for (const eserviceId of producerKeychain.eservices) {
    const eservice = await readModelService.getEServiceById(eserviceId);
    if (eservice && eservice.asyncExchange) {
      asyncEserviceNames.push(eservice.name);
    }
  }

  if (asyncEserviceNames.length === 0) {
    logger.info(
      `ProducerKeychain ${producerKeychain.id} has no async e-services, skipping no-keys-for-async-eservice email notification`
    );
    return [];
  }

  const eserviceNamesStr = asyncEserviceNames.join(", ");

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainNoKeysForAsyncEserviceMailTemplate
    ),
    retrieveTenant(producerKeychain.producerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. ProducerKeychain ${producerKeychain.id} has no keys for async e-services, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Attenzione: portachiavi "${producerKeychain.name}" senza chiavi per e-service asincroni`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Attenzione: portachiavi "${producerKeychain.name}" senza chiavi per e-service asincroni`,
        notificationType,
        entityId: producerKeychain.id,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        producerKeychainName: producerKeychain.name,
        eserviceNames: eserviceNamesStr,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}