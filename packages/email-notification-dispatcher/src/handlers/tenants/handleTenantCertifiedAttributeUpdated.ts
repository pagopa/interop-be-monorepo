import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  fromTenantV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveAttribute,
  retrieveTenantByCertifierId,
  TenantHandlerParams,
} from "../handlerCommons.js";
import { certifierDatabaseOriginNames } from "../../config/constants.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "certifiedVerifiedAttributeAssignedRevokedToAssignee";

export async function handleTenantCertifiedAttributeUpdated(
  data: TenantHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    tenantV2Msg,
    attributeId,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedAttributeUpdated"
    );
  }

  const tenant = fromTenantV2(tenantV2Msg);

  const [htmlTemplate, attribute] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.tenantCertifiedAttributeUpdatedMailTemplate
    ),
    retrieveAttribute(attributeId, readModelService),
  ]);

  if (!attribute.origin) {
    logger.error(
      `Origin of certified attribute ${attribute.id} cannot be undefined.`
    );
    return [];
  }

  const targets = await getRecipientsForTenants({
    tenants: [tenant],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleTenantCertifiedAttributeUpdated - entityId: ${tenant.id}, eventType: ${notificationType}`
    );
    return [];
  }

  const certifierName = certifierDatabaseOriginNames.includes(attribute.origin)
    ? attribute.origin
    : (await retrieveTenantByCertifierId(attribute.origin, readModelService))
        .name;

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Un tuo attributo certificato è stato aggiornato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Un tuo attributo certificato è stato aggiornato`,
        notificationType,
        entityId: tenant.id,
        ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
        certifierName,
        attributeName: attribute.name,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
