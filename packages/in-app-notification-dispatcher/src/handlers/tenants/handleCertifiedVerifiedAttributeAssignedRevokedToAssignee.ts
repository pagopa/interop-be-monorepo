import {
  AttributeId,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  TenantV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { retrieveAttribute } from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType:
    | "TenantCertifiedAttributeAssigned"
    | "TenantCertifiedAttributeRevoked"
    | "TenantVerifiedAttributeAssigned"
    | "TenantVerifiedAttributeRevoked"
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Handle certified/verified attribute assigned/revoked in-app notification for ${eventType} tenant ${tenantV2Msg.id}`
  );

  const tenant = fromTenantV2(tenantV2Msg);

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [tenant.id],
      "certifiedVerifiedAttributeAssignedRevokedToAssignee"
    );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${eventType} tenant ${tenant.id}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const body = match(eventType)
    .with("TenantCertifiedAttributeAssigned", () =>
      inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "certificato"
      )
    )
    .with("TenantCertifiedAttributeRevoked", () =>
      inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "certificato"
      )
    )
    .with("TenantVerifiedAttributeAssigned", () =>
      inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "verificato"
      )
    )
    .with("TenantVerifiedAttributeRevoked", () =>
      inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "verificato"
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
