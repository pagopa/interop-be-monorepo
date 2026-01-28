import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import {
  NotificationType,
  fromTenantV2,
  VerifiedTenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  TenantHandlerParams,
  getRecipientsForTenants,
  retrieveAttribute,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "certifiedVerifiedAttributeAssignedRevokedToAssignee";

export async function handleTenantVerifiedAttributeAssigned(
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
      "TenantVerifiedAttributeAssigned"
    );
  }

  const tenant = fromTenantV2(tenantV2Msg);

  const [htmlTemplate, attribute] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.tenantVerifiedAttributeAssignedMailTemplate
    ),
    retrieveAttribute(attributeId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [tenant],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleTenantVerifiedAttributeAssigned - entityId: ${tenant.id}, eventType: ${notificationType}`
    );
    return [];
  }

  const tenantAttribute = tenant.attributes.find(
    (attribute): attribute is VerifiedTenantAttribute =>
      attribute.type === tenantAttributeType.VERIFIED &&
      attribute.id === attributeId
  );

  if (!tenantAttribute) {
    logger.error(
      `Couldn't find verified attribute ${attributeId} found for tenant ${tenant.id}.`
    );
    return [];
  }

  if (tenantAttribute.verifiedBy.length === 0) {
    logger.error(`Attribute ${attributeId} was never verified.`);
    return [];
  }

  const verifierId = [...tenantAttribute.verifiedBy].sort(
    (a, b) => b.verificationDate.getTime() - a.verificationDate.getTime()
  )[0].id;

  const verifierTenant = await retrieveTenant(verifierId, readModelService);

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Hai ricevuto un nuovo attributo verificato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Hai ricevuto un nuovo attributo verificato`,
        notificationType,
        entityId: tenant.id,
        ...(t.type === "Tenant" ? { recipientName: tenant.name } : {}),
        verifierName: verifierTenant.name,
        attributeName: attribute.name,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
