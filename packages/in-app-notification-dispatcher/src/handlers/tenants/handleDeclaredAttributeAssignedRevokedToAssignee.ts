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
import {
  getNotificationRecipients,
  retrieveAttribute,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

type DeclaredAttributeAssignedRevokedEventType =
  | "TenantDeclaredAttributeAssigned"
  | "TenantDeclaredAttributeRevoked";

export async function handleDeclaredAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: DeclaredAttributeAssignedRevokedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Handle declared attribute assigned/revoked in-app notification for ${eventType} tenant ${tenantV2Msg.id}`
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
      `No users with notifications enabled for ${eventType} tenant ${tenant.id}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const body = match(eventType)
    .with("TenantDeclaredAttributeAssigned", () =>
      inAppTemplates.declaredAttributeAssignedToAssignee(attribute.name)
    )
    .with("TenantDeclaredAttributeRevoked", () =>
      inAppTemplates.declaredAttributeRevokedToAssignee(attribute.name)
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
