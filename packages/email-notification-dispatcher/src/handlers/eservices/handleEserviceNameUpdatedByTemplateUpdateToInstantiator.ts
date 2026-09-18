import {
  EmailNotificationMessagePayload,
  EServiceEventV2,
  EServiceIdDescriptorId,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  retrieveTenant,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { HandlerCommonParams } from "../../models/handlerParams.js";

type EServiceNameUpdatedByTemplateUpdateEvent = Extract<
  EServiceEventV2,
  { type: "EServiceNameUpdatedByTemplateUpdate" }
>;

type EServiceNameUpdatedByTemplateUpdateHandlerParams = HandlerCommonParams & {
  payload: EServiceNameUpdatedByTemplateUpdateEvent;
};

const notificationType: NotificationType =
  "eserviceTemplateNameChangedToInstantiator";

export async function handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
  params: EServiceNameUpdatedByTemplateUpdateHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const { payload, readModelService, logger, templateService, correlationId } =
    params;

  const eserviceV2Msg = payload.data.eservice;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError("eservice", payload.type);
  }

  const eservice = fromEServiceV2(eserviceV2Msg);
  // Legacy events may not carry the previous name: fall back to the eservice id
  const oldName = payload.data.oldName ?? eservice.id;

  const [htmlTemplate, instantiator] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceTemplateNameUpdatedMailTemplate
    ),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [instantiator],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEserviceNameUpdatedByTemplateUpdateToInstantiator - entityId: ${eservice.id}, eventType: ${payload.type}`
    );
    return [];
  }

  const title = `Il tuo e-service "${oldName}" è stato rinominato`;
  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${retrieveLatestDescriptor(eservice).id}`
  );

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: title,
      body: templateService.compileHtml(htmlTemplate, {
        title,
        notificationType,
        entityId,
        ...(t.type === "Tenant" ? { recipientName: instantiator.name } : {}),
        oldName,
        newName: eservice.name,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
