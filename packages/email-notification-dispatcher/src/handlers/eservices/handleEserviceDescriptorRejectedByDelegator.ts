import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  fromEServiceV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveProducerDelegation,
  retrieveTenant,
} from "../../services/utils.js";
import {
  EServiceHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "eserviceNewVersionApprovedRejectedToDelegate";

export async function handleEserviceDescriptorRejectedByDelegator(
  data: EServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorRejectedByDelegator"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, delegation] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorRejectedByDelegatorMailTemplate
    ),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [delegator, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [delegate],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. EService ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Rifiutata la pubblicazione della nuova versione`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Rifiutata la pubblicazione della nuova versione`,
        notificationType,
        entityId: eservice.id,
        ...(t.type === "Tenant" ? { recipientName: delegate.name } : {}),
        delegatorName: delegator.name,
        eserviceName: eservice.name,
        tenantId: t.tenantId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
