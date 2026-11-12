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
  inAppTemplates,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleCertifiedDiscreteAttributeUpdatedToAssignee(
  tenant: Tenant | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!tenant) {
    throw missingKafkaMessageDataError(
      "tenant",
      "TenantCertifiedDiscreteAttributeUpdated"
    );
  }
  logger.info(
    `Sending in-app notification for handleCertifiedDiscreteAttributeUpdatedToAssignee - entityId: ${tenant.id}, eventType: TenantCertifiedDiscreteAttributeUpdated`
  );

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
