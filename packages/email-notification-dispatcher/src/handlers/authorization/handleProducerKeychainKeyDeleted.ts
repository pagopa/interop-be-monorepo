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
  ProducerKeychainKeyHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { producerKeychainKeyNotFound } from "../../models/errors.js";

const notificationType: NotificationType =
  "producerKeychainKeyAddedDeletedToClientUsers";

export async function handleProducerKeychainKeyDeleted(
  data: ProducerKeychainKeyHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    producerKeychainV2Msg,
    kid,
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
  const key = producerKeychain.keys.find((key) => key.kid === kid);

  if (!key) {
    throw producerKeychainKeyNotFound(producerKeychain.id, kid);
  }

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainKeyDeletedMailTemplate
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
  ).filter((target) => target.type !== "User" || target.userId !== key.userId);

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. ProducerKeychain ${producerKeychain.id}, key ${kid}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Una chiave di e-service è stata rimossa`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Una chiave di e-service è stata rimossa`,
        notificationType,
        entityId: producerKeychain.id,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        userName: key.userId,
        producerKeychainName: producerKeychain.name,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
