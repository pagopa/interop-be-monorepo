import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  fromProducerKeychainV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  ProducerKeychainUserHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "producerKeychainKeyAddedDeletedToClientUsers";

export async function handleProducerKeychainUserDeleted(
  data: ProducerKeychainUserHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    producerKeychainV2Msg,
    userId,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!producerKeychainV2Msg) {
    throw missingKafkaMessageDataError(
      "producerKeychain",
      "ProducerKeychainUserDeleted"
    );
  }

  const producerKeychain = fromProducerKeychainV2(producerKeychainV2Msg);

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainUserDeletedMailTemplate
    ),
    retrieveTenant(producerKeychain.producerId, readModelService),
  ]);

  const targets = (
    await getRecipientsForTenants({
      tenants: [producer],
      notificationType,
      readModelService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter((target) => target.type !== "User" || target.userId !== userId);

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. ProducerKeychain ${producerKeychain.id}, user ${userId}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Attenzione: una chiave non è più sicura`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Attenzione: una chiave non è più sicura`,
        notificationType,
        entityId: producerKeychain.id,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        producerKeychainName: producerKeychain.name,
        ctaLabel: `Gestisci chiavi`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
