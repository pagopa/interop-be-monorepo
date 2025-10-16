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
  "delegationApprovedRejectedToDelegator";

export async function handleConsumerDelegationRejected(
  data: DelegationHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    delegationV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!delegationV2Msg) {
    throw missingKafkaMessageDataError(
      "delegation",
      "ConsumerDelegationRejected"
    );
  }

  const delegation = fromDelegationV2(delegationV2Msg);

  const [htmlTemplate, eservice, delegator, delegate] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.consumerDelegationRejectedMailTemplate
    ),
    retrieveEService(delegation.eserviceId, readModelService),
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [delegator],
    notificationType,
    readModelService,
    userService,
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
      subject: `La tua richiesta di delega è stata rifiutata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `La tua richiesta di delega è stata rifiutata`,
        notificationType,
        entityId: delegation.id,
        ...(t.type === "Tenant" ? { recipientName: delegator.name } : {}),
        delegateName: delegate.name,
        eserviceName: eservice.name,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
