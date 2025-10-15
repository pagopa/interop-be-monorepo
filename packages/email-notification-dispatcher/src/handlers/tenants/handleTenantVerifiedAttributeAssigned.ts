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
    userService,
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
        recipientName: tenant.name,
        verifierName: verifierTenant.name,
        attributeName: attribute.name,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
