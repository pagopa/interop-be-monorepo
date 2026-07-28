import { Logger } from "pagopa-interop-commons";
import {
  AttributeId,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  TenantV2,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenantByCertifierId,
  inAppTemplates,
  attributeOriginUndefined,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

const IMPORTED_ATTRIBUTE_ORIGINS = ["ISTAT"];

type CertifiedDiscreteAttributeAssignedRevokedUpdatedEventType =
  | "TenantCertifiedDiscreteAttributeAssigned"
  | "TenantCertifiedDiscreteAttributeRevoked"
  | "TenantCertifiedDiscreteAttributeUpdated";

export async function handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: CertifiedDiscreteAttributeAssignedRevokedUpdatedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Sending in-app notification for handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee - entityId: ${tenantV2Msg.id}, eventType: ${eventType}`
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
      `No users with notifications enabled for handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee - entityId: ${tenant.id}, eventType: ${eventType}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const body = await match(eventType)
    .with("TenantCertifiedDiscreteAttributeAssigned", async () => {
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
    .with("TenantCertifiedDiscreteAttributeRevoked", async () => {
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
    .with("TenantCertifiedDiscreteAttributeUpdated", async () =>
      inAppTemplates.certifiedVerifiedAttributeUpdatedToAssignee(
        attribute.name,
        "certificato"
      )
    )
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
    entityId: attribute.id,
  }));
}
