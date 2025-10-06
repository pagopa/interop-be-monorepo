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
} from "../../services/utils.js";
import {
  EserviceTemplateHandlerParams,
  getRecipientsForTenants,
  retrieveLatestPublishedEServiceTemplateVersion,
} from "../handlerCommons.js";

const notificationType: NotificationType = "templateStatusChangedToProducer";

export async function handleEServiceTemplateVersionSuspendedToCreator(
  params: EserviceTemplateHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceTemplateV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = params;

  if (!eserviceTemplateV2Msg) {
    throw missingKafkaMessageDataError(
      "eserviceTemplate",
      "EServiceTemplateVersionSuspended"
    );
  }

  const eserviceTemplate = fromEServiceTemplateV2(eserviceTemplateV2Msg);

  const [htmlTemplate, creator] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateVersionSuspendedToCreatorMailTemplate
    ),
    retrieveTenant(eserviceTemplate.creatorId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [creator],
    notificationType,
    readModelService,
    userService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. EService template ${eserviceTemplate.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Hai sospeso un tuo template e-service`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Hai sospeso un tuo template e-service",
        notificationType,
        entityId: EServiceTemplateIdEServiceTemplateVersionId.parse(
          `${eserviceTemplate.id}/${retrieveLatestPublishedEServiceTemplateVersion(eserviceTemplate).id
          }`
        ),
        creatorName: creator.name,
        templateName: eserviceTemplate.name,
        ctaLabel: `Visualizza template`,
      }),
    },
    address,
  }));
}
