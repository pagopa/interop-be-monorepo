import {
  AttributeId,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  TenantV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenantByCertifierId,
  inAppTemplates,
  attributeOriginUndefined,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

const IMPORTED_ATTRIBUTE_ORIGINS = ["IPA", "SELFCARE"];

type CertifiedAttributeAssignedRevokedEventType =
  | "TenantCertifiedAttributeAssigned"
  | "TenantCertifiedAttributeRevoked";

export async function handleCertifiedAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: CertifiedAttributeAssignedRevokedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Sending in-app notification for handleCertifiedAttributeAssignedRevokedToAssignee - entityId: ${tenantV2Msg.id}, eventType: ${eventType}`
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
      `No users with notifications enabled for handleCertifiedAttributeAssignedRevokedToAssignee - entityId: ${tenant.id}, eventType: ${eventType}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const body = await match(eventType)
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
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}
