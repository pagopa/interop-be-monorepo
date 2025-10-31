import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  fromDelegationV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  DelegationHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "delegationSubmittedRevokedToDelegate";

export async function handleProducerDelegationSubmitted(
  data: DelegationHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    delegationV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!delegationV2Msg) {
    throw missingKafkaMessageDataError(
      "delegation",
      "ProducerDelegationSubmitted"
    );
  }

  const delegation = fromDelegationV2(delegationV2Msg);

  const [htmlTemplate, eservice, delegator, delegate] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.producerDelegationSubmittedMailTemplate
    ),
    retrieveEService(delegation.eserviceId, readModelService),
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
      `No targets found for tenant. Delegation ${delegation.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Hai ricevuto una richiesta di delega`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Hai ricevuto una richiesta di delega`,
        notificationType,
        entityId: delegation.id,
        ...(t.type === "Tenant" ? { recipientName: delegate.name } : {}),
        delegatorName: delegator.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza richiesta di delega`,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
