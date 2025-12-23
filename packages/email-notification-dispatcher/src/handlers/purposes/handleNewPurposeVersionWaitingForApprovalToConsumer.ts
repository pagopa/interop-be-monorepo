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
  retrieveLatestDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  PurposeHandlerParams,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "purposeOverQuotaStateToConsumer";

export async function handleNewPurposeVersionWaitingForApprovalToConsumer(
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
      "NewPurposeVersionWaitingForApproval"
    );
  }
  const purpose = fromPurposeV2(purposeV2Msg);

  const [htmlTemplate, eservice] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeQuotaOverthresholdMailTemplate
    ),
    retrieveEService(purpose.eserviceId, readModelService),
  ]);

  const { dailyCallsPerConsumer } = retrieveLatestDescriptor(eservice);

  const consumer = await retrieveTenant(purpose.consumerId, readModelService);

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
      subject: `Superamento soglia piano di carico per l'e-service "${eservice.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Superamento soglia piano di carico per l'e-service "${eservice.name}"`,
        notificationType,
        entityId: purpose.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        eserviceName: eservice.name,
        dailyCalls: dailyCallsPerConsumer,
        isNewVersion: true,
        ctaLabel: `Gestisci finalità`,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: consumer.id,
    ...mapRecipientToEmailPayload(t),
  }));
}
