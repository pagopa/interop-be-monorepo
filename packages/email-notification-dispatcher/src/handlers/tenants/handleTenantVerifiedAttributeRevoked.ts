import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
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
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "certifiedVerifiedAttributeAssignedRevokedToAssignee";

export async function handleTenantVerifiedAttributeRevoked(
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
      "TenantVerifiedAttributeRevoked"
    );
  }

  const tenant = fromTenantV2(tenantV2Msg);

  const [htmlTemplate, attribute] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.tenantVerifiedAttributeRevokedMailTemplate
    ),
    retrieveAttribute(attributeId, readModelService),
  ]);

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
      `No targets found for tenant. Agreement ${tenant.id}, no emails to dispatch.`
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

  if (tenantAttribute.revokedBy.length === 0) {
    logger.error(`Attribute ${attributeId} was never verified.`);
    return [];
  }

  const verifierId = [...tenantAttribute.revokedBy].sort(
    (a, b) => b.verificationDate.getTime() - a.verificationDate.getTime()
  )[0].id;

  const verifierTenant = await retrieveTenant(verifierId, readModelService);

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Un tuo attributo verificato è stato revocato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Un tuo attributo verificato è stato revocato`,
        notificationType,
        entityId: tenant.id,
        verifierName: verifierTenant.name,
        tenantName: tenant.name,
        attributeName: attribute.name,
      }),
    },
    address,
  }));
}
