import {
  Attribute,
  AttributeId,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  Tenant,
  tenantAttributeType,
  TenantV2,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenant,
  retrieveTenantByCertifierId,
  inAppTemplates,
  attributeOriginUndefined,
  verifiedAttributeNotFoundInTenant,
} from "pagopa-interop-notification-commons";

type CertifiedVerifiedAttributeAssignedRevokedEventType =
  | "TenantCertifiedAttributeAssigned"
  | "TenantCertifiedAttributeRevoked"
  | "TenantVerifiedAttributeAssigned"
  | "TenantVerifiedAttributeRevoked";

export async function handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: CertifiedVerifiedAttributeAssignedRevokedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Sending in-app notification for handleCertifiedVerifiedAttributeAssignedRevokedToAssignee - entityId: ${tenantV2Msg.id}, eventType: ${eventType}`
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
      `No users with notifications enabled for handleCertifiedVerifiedAttributeAssignedRevokedToAssignee - entityId: ${tenant.id}, eventType: ${eventType}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const body = await getNotificationBody(
    eventType,
    tenant,
    attribute,
    readModelService
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}

const IMPORTED_ATTRIBUTE_ORIGINS = ["IPA", "SELFCARE"];

async function getNotificationBody(
  eventType: CertifiedVerifiedAttributeAssignedRevokedEventType,
  tenant: Tenant,
  attribute: Attribute,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  return match(eventType)
    .with("TenantCertifiedAttributeAssigned", async () => {
      if (!attribute.origin) {
        throw attributeOriginUndefined(attribute.id);
      }
      if (IMPORTED_ATTRIBUTE_ORIGINS.includes(attribute.origin)) {
        return inAppTemplates.certifiedAttributeAssignedToAssigneeFromImport(
          attribute.name
        );
      }
      const certifier = await retrieveTenantByCertifierId(
        attribute.origin,
        readModelService
      );
      return inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "certificato",
        certifier.name
      );
    })
    .with("TenantCertifiedAttributeRevoked", async () => {
      if (!attribute.origin) {
        throw attributeOriginUndefined(attribute.id);
      }
      if (IMPORTED_ATTRIBUTE_ORIGINS.includes(attribute.origin)) {
        return inAppTemplates.certifiedAttributeRevokedToAssigneeFromImport(
          attribute.name
        );
      }
      const certifier = await retrieveTenantByCertifierId(
        attribute.origin,
        readModelService
      );
      return inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "certificato",
        certifier.name
      );
    })
    .with("TenantVerifiedAttributeAssigned", async () => {
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
      const verifier = await retrieveTenant(tenantId, readModelService);
      return inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "verificato",
        verifier.name
      );
    })
    .with("TenantVerifiedAttributeRevoked", async () => {
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
      const revoker = await retrieveTenant(tenantId, readModelService);
      return inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "verificato",
        revoker.name
      );
    })
    .exhaustive();
}
