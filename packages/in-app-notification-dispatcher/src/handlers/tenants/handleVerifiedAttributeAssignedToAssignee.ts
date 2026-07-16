import {
  AttributeId,
  Attribute,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  Tenant,
  tenantAttributeType,
  TenantV2,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenant,
  inAppTemplates,
  verifiedAttributeNotFoundInTenant,
} from "pagopa-interop-notification-commons";

export async function handleVerifiedAttributeAssignedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantVerifiedAttributeAssigned"
    );
  }
  logger.info(
    `Sending in-app notification for handleVerifiedAttributeAssignedToAssignee - entityId: ${tenantV2Msg.id}, eventType: TenantVerifiedAttributeAssigned`
  );

  const tenant = fromTenantV2(tenantV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [tenant.id],
    "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleVerifiedAttributeAssignedToAssignee - entityId: ${tenant.id}, eventType: TenantVerifiedAttributeAssigned`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const assignerName = await getAttributeAssignerName(
    tenant,
    attribute,
    readModelService
  );

  const body = inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
    attribute.name,
    "verificato",
    assignerName
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}

async function getAttributeAssignerName(
  tenant: Tenant,
  attribute: Attribute,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  const tenantAttribute = tenant.attributes.find(
    (attr): attr is VerifiedTenantAttribute =>
      attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
  );
  if (!tenantAttribute || tenantAttribute.verifiedBy.length === 0) {
    throw verifiedAttributeNotFoundInTenant(tenant.id, attribute.id);
  }
  const tenantId = [...tenantAttribute.verifiedBy].sort(
    (a, b) => b.verificationDate.getTime() - a.verificationDate.getTime()
  )[0].id;
  return (await retrieveTenant(tenantId, readModelService)).name;
}
