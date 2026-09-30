import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { PurposeHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType = "purposeStatusChangedToProducer";

export async function handlePurposeVersionSuspendedByConsumer(
  data: PurposeHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError(
      "purpose",
      "PurposeVersionSuspendedByConsumer"
    );
  }
  const purpose = fromPurposeV2(purposeV2Msg);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeVersionSuspendedByConsumerMailTemplate
    ),
    retrieveEservice(purpose.eserviceId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);

  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handlePurposeVersionSuspendedByConsumer - entityId: ${purpose.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Finalità sospesa dal fruitore`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Finalità sospesa dal fruitore`,
        notificationType,
        entityId: purpose.id,
        consumerName: consumer.name,
        ...(t.type === "Tenant" ? { producerName: producer.name } : {}),
        eserviceName: eservice.name,
        purposeTitle: purpose.title,
        ctaLabel: `Visualizza finalità`,
        selfcareId: producer.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: producer.id,
    ...mapRecipientToEmailPayload(t),
  }));
}
