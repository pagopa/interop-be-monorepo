import { Logger } from "pagopa-interop-commons";
import {
  AttributeId,
  Attribute,
  missingKafkaMessageDataError,
  NewNotification,
  Tenant,
  tenantAttributeType,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenant,
  inAppTemplates,
  verifiedAttributeNotFoundInTenant,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleVerifiedAttributeRevokedToAssignee(
  tenant: Tenant | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenant) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantVerifiedAttributeRevoked"
    );
  }
  logger.info(
    `Sending in-app notification for handleVerifiedAttributeRevokedToAssignee - entityId: ${tenant.id}, eventType: TenantVerifiedAttributeRevoked`
  );

  const usersWithNotifications = await getNotificationRecipients(
    [tenant.id],
    "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleVerifiedAttributeRevokedToAssignee - entityId: ${tenant.id}, eventType: TenantVerifiedAttributeRevoked`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const revokerName = await getAttributeRevokerName(
    tenant,
    attribute,
    readModelService
  );

  const body = inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
    attribute.name,
    "verificato",
    revokerName
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}

async function getAttributeRevokerName(
  tenant: Tenant,
  attribute: Attribute,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  const tenantAttribute = tenant.attributes.find(
    (attr): attr is VerifiedTenantAttribute =>
      attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
  );
  if (!tenantAttribute || tenantAttribute.revokedBy.length === 0) {
    throw verifiedAttributeNotFoundInTenant(tenant.id, attribute.id);
  }
  const tenantId = [...tenantAttribute.revokedBy].sort(
    (a, b) => b.revocationDate.getTime() - a.revocationDate.getTime()
  )[0].id;
  return (await retrieveTenant(tenantId, readModelService)).name;
}
