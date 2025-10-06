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
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "delegationSubmittedRevokedToDelegate";

export async function handleEserviceDescriptorSubmittedByDelegate(
  data: EServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorPublishedByDelegate"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, delegation] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorSubmittedByDelegateMailTemplate
    ),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [delegator, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [delegator],
    notificationType,
    readModelService,
    userService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. EService ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Richiesta di approvazione per una nuova versione`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Richiesta di approvazione per una nuova versione`,
        notificationType,
        entityId: eservice.id,
        delegatorName: delegator.name,
        delegateName: delegate.name,
        eserviceName: eservice.name,
        ctaLabel: "Valuta la richiesta",
      }),
    },
    address,
  }));
}
