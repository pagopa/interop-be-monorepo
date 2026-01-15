import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  PurposeHandlerParams,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "purposeStatusChangedToProducer";

export async function handlePurposeArchived(
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
    throw missingKafkaMessageDataError("purpose", "PurposeArchived");
  }
  const purpose = fromPurposeV2(purposeV2Msg);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.purposeArchivedMailTemplate),
    retrieveEService(purpose.eserviceId, readModelService),
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
      `No targets found for tenant. Purpose ${purpose.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Finalità archiviata dal fruitore`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Finalità archiviata dal fruitore`,
        notificationType,
        entityId: purpose.id,
        consumerName: consumer.name,
        ...(t.type === "Tenant" ? { producerName: producer.name } : {}),
        eserviceName: eservice.name,
        purposeTitle: purpose.title,
        ctaLabel: `Visualizza finalità`,
        tenantId: producer.id,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: producer.id,
    ...mapRecipientToEmailPayload(t),
  }));
}
