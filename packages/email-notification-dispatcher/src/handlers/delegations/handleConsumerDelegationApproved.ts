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
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "delegationApprovedRejectedToDelegator";

export async function handleConsumerDelegationApproved(
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
      "ConsumerDelegationApproved"
    );
  }

  const delegation = fromDelegationV2(delegationV2Msg);

  const [htmlTemplate, eservice, delegator, delegate] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.consumerDelegationApprovedMailTemplate
    ),
    retrieveEService(delegation.eserviceId, readModelService),
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [delegator],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleConsumerDelegationApproved - entityId: ${delegation.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `La tua richiesta di delega è stata accettata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `La tua richiesta di delega è stata accettata`,
        notificationType,
        entityId: delegation.id,
        ...(t.type === "Tenant" ? { recipientName: delegator.name } : {}),
        delegateName: delegate.name,
        eserviceName: eservice.name,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
