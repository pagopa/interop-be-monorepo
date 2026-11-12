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

const IMPORTED_ATTRIBUTE_ORIGINS = ["ISTAT"];

export async function handleCertifiedDiscreteAttributeAssignedToAssignee(
  tenant: Tenant | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenant) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedDiscreteAttributeAssigned"
    );
  }
  logger.info(
    `Sending in-app notification for handleCertifiedDiscreteAttributeAssignedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedDiscreteAttributeAssigned`
  );

  const usersWithNotifications = await getNotificationRecipients(
    [tenant.id],
    "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleCertifiedDiscreteAttributeAssignedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedDiscreteAttributeAssigned`
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
