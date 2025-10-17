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
  TenantHandlerParams,
  getRecipientsForTenants,
  retrieveAttribute,
  retrieveTenantByCertifierId,
} from "../handlerCommons.js";
import { certifierDatabaseOriginNames } from "../../config/constants.js";

const notificationType: NotificationType =
  "certifiedVerifiedAttributeAssignedRevokedToAssignee";

export async function handleTenantCertifiedAttributeAssigned(
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
      "TenantCertifiedAttributeAssigned"
    );
  }

  const tenant = fromTenantV2(tenantV2Msg);

  const [htmlTemplate, attribute] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.tenantCertifiedAttributeAssignedMailTemplate
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

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Hai ricevuto un nuovo attributo certificato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Hai ricevuto un nuovo attributo certificato`,
        notificationType,
        entityId: tenant.id,
        certifierName,
        tenantName: tenant.name,
        attributeName: attribute.name,
      }),
    },
    address,
  }));
}
