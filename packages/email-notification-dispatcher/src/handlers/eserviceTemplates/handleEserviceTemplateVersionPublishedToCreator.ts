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

export async function handleEServiceTemplateVersionPublishedToCreator(
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
      "EServiceTemplateVersionPublished"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (version) => version.id === eserviceTemplateVersionId
  );

  if (!eserviceTemplateVersion) {
    logger.error(
      `No version found in eservice template ${eserviceTemplate.id} with id ${eserviceTemplateVersionId}`
    );
    return [];
  }

  const [htmlTemplate, creator] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateVersionPublishedToCreatorMailTemplate
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
      `No users with email notifications enabled for handleEServiceTemplateVersionPublishedToCreator - entityId: ${eserviceTemplate.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Hai pubblicato una nuova versione del tuo template e-service`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Hai pubblicato una nuova versione del tuo template e-service",
        notificationType,
        entityId: EServiceTemplateIdEServiceTemplateVersionId.parse(
          `${eserviceTemplate.id}/${eserviceTemplateVersionId}`
        ),
        ...(t.type === "Tenant" ? { recipientName: creator.name } : {}),
        version: eserviceTemplateVersion.version,
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
