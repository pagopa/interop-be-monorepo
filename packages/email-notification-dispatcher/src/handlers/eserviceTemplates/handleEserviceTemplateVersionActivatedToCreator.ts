import {
  EmailNotificationMessagePayload,
  EServiceTemplateIdEServiceTemplateVersionId,
  fromEServiceTemplateV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "pagopa-interop-notification-commons";
import { EserviceTemplateHandlerParams } from "../../models/handlerParams.js";

import { config } from "../../config/config.js";

const notificationType: NotificationType = "templateStatusChangedToProducer";

export async function handleEServiceTemplateVersionActivatedToCreator(
  params: EserviceTemplateHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    eserviceTemplateVersionId,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = params;

  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionActivated"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const [htmlTemplate, creator] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateVersionActivatedToCreatorMailTemplate
    ),
    retrieveTenant(eserviceTemplate.creatorId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [creator],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEServiceTemplateVersionActivatedToCreator - entityId: ${eserviceTemplate.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Hai riattivato un tuo template e-service`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Hai riattivato un tuo template e-service",
        notificationType,
        entityId: EServiceTemplateIdEServiceTemplateVersionId.parse(
          `${eserviceTemplate.id}/${eserviceTemplateVersionId}`
        ),
        ...(t.type === "Tenant" ? { recipientName: creator.name } : {}),
        templateName: eserviceTemplate.name,
        ctaLabel: `Visualizza template`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
