import { Logger } from "pagopa-interop-commons";
import {
  AttributeId,
  missingKafkaMessageDataError,
  NewNotification,
  Tenant,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenantByCertifierId,
  inAppTemplates,
  attributeOriginUndefined,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

const IMPORTED_ATTRIBUTE_ORIGINS = ["IPA", "SELFCARE"];

export async function handleCertifiedAttributeRevokedToAssignee(
  tenant: Tenant | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenant) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedAttributeRevoked"
    );
  }
  logger.info(
    `Sending in-app notification for handleCertifiedAttributeRevokedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedAttributeRevoked`
  );

  const usersWithNotifications = await getNotificationRecipients(
    [tenant.id],
    "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleCertifiedAttributeRevokedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedAttributeRevoked`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  if (!attribute.origin) {
    throw attributeOriginUndefined(attribute.id);
  }

  const body = IMPORTED_ATTRIBUTE_ORIGINS.includes(attribute.origin)
    ? inAppTemplates.certifiedAttributeRevokedToAssigneeFromImport(
        attribute.name
      )
    : inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
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
