/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  tenantMailKind,
} from "pagopa-interop-models";
import { getLatestTenantMailOfKind } from "pagopa-interop-commons";
import { getUserEmailsToNotify, HandlePurposeData } from "../handlerCommons.js";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export async function handlePurposeVersionUnsuspendedByProducer(
  data: HandlePurposeData
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError(
      "purpose",
      "PurposeVersionUnsuspendedByProducer"
    );
  }

  const purpose = fromPurposeV2(purposeV2Msg);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeVersionUnsuspendedByProducerMailTemplate
    ),
    retrieveEService(purpose.eserviceId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);

  const producer = await retrieveTenant(eservice.producerId, readModelService);

  let userEmails: string[] = [];
  try {
    userEmails = await getUserEmailsToNotify(
      consumer.id,
      notificationType,
      readModelService,
      userService
    );
  } catch (error) {
    logger.warn(`Error reading user email. Reason: ${error}`);
    return [];
  }

  let toDispatch: EmailNotificationMessagePayload[] = [];
  if (userEmails.length > 0) {
    toDispatch = userEmails.map((email: string) => ({
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Riattivazione della finalità "${purpose.title}"`,
        body: templateService.compileHtml(htmlTemplate, {
          title: `Riattivazione della finalità "${purpose.title}"`,
          notificationType,
          entityId: purpose.id,
          producerName: producer.name,
          consumerName: consumer.name,
        }),
      },
      address: email,
    }));
  } else {
    logger.info(
      `No users found for tenant ${consumer.id}. No emails to dispatch for purpose ${purpose.id}.`
    );
  }

  const consumerConfig =
    await readModelService.getTenantNotificationConfigByTenantId(consumer.id);

  if (consumerConfig === undefined) {
    logger.warn(`No tenant configuration found for tenant ${consumer.id}.`);
  } else if (consumerConfig.enabled) {
    const consumerEmail = getLatestTenantMailOfKind(
      consumer.mails,
      tenantMailKind.ContactEmail
    );

    if (consumerEmail !== undefined) {
      toDispatch.push({
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Riattivazione della finalità "${purpose.title}"`,
          body: templateService.compileHtml(htmlTemplate, {
            title: `Riattivazione della finalità "${purpose.title}"`,
            notificationType,
            entityId: purpose.id,
            producerName: producer.name,
            eserviceName: eservice.name,
            purposeTitle: purpose.title,
          }),
        },
        address: consumerEmail.address,
      });
    } else {
      logger.warn(
        `No consumer email found for purpose ${purpose.id}. No email to dispatch.`
      );
    }
  }

  return toDispatch;
}
