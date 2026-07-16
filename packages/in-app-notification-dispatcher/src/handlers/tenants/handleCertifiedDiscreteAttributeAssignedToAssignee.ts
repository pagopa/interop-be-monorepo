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

const IMPORTED_ATTRIBUTE_ORIGINS = ["ISTAT"];

export async function handleCertifiedDiscreteAttributeAssignedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedDiscreteAttributeAssigned"
    );
  }
  logger.info(
    `Sending in-app notification for handleCertifiedDiscreteAttributeAssignedToAssignee - entityId: ${tenantV2Msg.id}, eventType: TenantCertifiedDiscreteAttributeAssigned`
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
