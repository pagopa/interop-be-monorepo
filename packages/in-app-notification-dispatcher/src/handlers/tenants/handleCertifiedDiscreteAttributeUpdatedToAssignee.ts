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
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleCertifiedDiscreteAttributeUpdatedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedDiscreteAttributeUpdated"
    );
  }
  logger.info(
    `Sending in-app notification for handleCertifiedDiscreteAttributeUpdatedToAssignee - entityId: ${tenantV2Msg.id}, eventType: TenantCertifiedDiscreteAttributeUpdated`
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
      `No users with notifications enabled for handleCertifiedDiscreteAttributeUpdatedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedDiscreteAttributeUpdated`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const body = inAppTemplates.certifiedVerifiedAttributeUpdatedToAssignee(
    attribute.name,
    "certificato"
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}
