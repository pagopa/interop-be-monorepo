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
  UserEmailNotificationRecipient,
  getRecipientsForTenants,
} from "../handlerCommons.js";
import { producerKeychainKeyNotFound } from "../../models/errors.js";

const notificationType: NotificationType =
  "producerKeychainKeyAddedDeletedToClientUsers";

export async function handleProducerKeychainKeyAdded(
  data: ProducerKeychainKeyHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    producerKeychainV2Msg,
    kid,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!producerKeychainV2Msg) {
    throw missingKafkaMessageDataError(
      "producerKeychain",
      "ProducerKeychainKeyAdded"
    );
  }

  const producerKeychain = fromProducerKeychainV2(producerKeychainV2Msg);
  const key = producerKeychain.keys.find((key) => key.kid === kid);

  if (!key) {
    throw producerKeychainKeyNotFound(producerKeychain.id, kid);
  }

  const [htmlTemplate, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerKeychainKeyAddedMailTemplate
    ),
    retrieveTenant(producerKeychain.producerId, readModelService),
  ]);

  const targets = (
    await getRecipientsForTenants({
      tenants: [producer],
      notificationType,
      readModelService,
      userService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter(
    (target): target is UserEmailNotificationRecipient =>
      target.type === "User" && target.userId !== key.userId
  );

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. ProducerKeychain ${producerKeychain.id}, key ${kid}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Nuova chiave aggiunta al client "${producerKeychain.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Nuova chiave aggiunta al client "${producerKeychain.name}"`,
        notificationType,
        entityId: producerKeychain.id,
        producerName: producer.name,
        clientName: producerKeychain.name,
      }),
    },
    address,
  }));
}
