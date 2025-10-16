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

const notificationType: NotificationType =
  "certifiedVerifiedAttributeAssignedRevokedToAssignee";

export async function handleTenantCertifiedAttributeRevoked(
  data: TenantHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    tenantV2Msg,
    attributeId,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedAttributeRevoked"
    );
  }

  const tenant = fromTenantV2(tenantV2Msg);

  const [htmlTemplate, attribute] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.tenantCertifiedAttributeRevokedMailTemplate
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
    userService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Tenant ${tenant.id}, no emails to dispatch.`
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
      subject: `Un tuo attributo certificato è stato revocato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Un tuo attributo certificato è stato revocato`,
        notificationType,
        entityId: tenant.id,
        ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
        certifierName,
        attributeName: attribute.name,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
