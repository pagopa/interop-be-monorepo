/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  PurposeHandlerParams,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export async function handlePurposeVersionSuspendedByProducer(
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
      "PurposeVersionSuspendedByProducer"
    );
  }

  const purpose = fromPurposeV2(purposeV2Msg);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeVersionSuspendedByProducerMailTemplate
    ),
    retrieveEService(purpose.eserviceId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);

  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Purpose ${purpose.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Sospensione della finalità "${purpose.title}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Sospensione della finalità "${purpose.title}"`,
        notificationType,
        entityId: purpose.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        producerName: producer.name,
        eserviceName: eservice.name,
        purposeTitle: purpose.title,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
