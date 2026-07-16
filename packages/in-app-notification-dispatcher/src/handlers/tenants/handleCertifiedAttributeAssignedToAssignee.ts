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
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

const IMPORTED_ATTRIBUTE_ORIGINS = ["IPA", "SELFCARE"];

export async function handleCertifiedAttributeAssignedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedAttributeAssigned"
    );
  }
  logger.info(
    `Sending in-app notification for handleCertifiedAttributeAssignedToAssignee - entityId: ${tenantV2Msg.id}, eventType: TenantCertifiedAttributeAssigned`
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
      `No users with notifications enabled for handleCertifiedAttributeAssignedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedAttributeAssigned`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  if (!attribute.origin) {
    throw attributeOriginUndefined(attribute.id);
  }

  const body = IMPORTED_ATTRIBUTE_ORIGINS.includes(attribute.origin)
    ? inAppTemplates.certifiedAttributeAssignedToAssigneeFromImport(
        attribute.name
      )
    : inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "certificato",
        (await retrieveTenantByCertifierId(attribute.origin, readModelService))
          .name
      );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}
