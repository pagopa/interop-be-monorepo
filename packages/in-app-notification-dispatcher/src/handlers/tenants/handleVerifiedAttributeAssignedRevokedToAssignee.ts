import {
  AttributeId,
  Attribute,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  TenantV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenant,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { match } from "ts-pattern";
import { verifiedAttributeNotFoundInTenant } from "../../models/errors.js";

type VerifiedAttributeAssignedRevokedEventType =
  | "TenantVerifiedAttributeAssigned"
  | "TenantVerifiedAttributeRevoked";

export async function handleVerifiedAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: VerifiedAttributeAssignedRevokedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Sending in-app notification for handleVerifiedAttributeAssignedRevokedToAssignee - entityId: ${tenantV2Msg.id}, eventType: ${eventType}`
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
      `No users with notifications enabled for handleVerifiedAttributeAssignedRevokedToAssignee - entityId: ${tenant.id}, eventType: ${eventType}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const assignerOrRevokerName = await getAttributeAssignerOrRevokerName(
    eventType,
    tenant,
    attribute,
    readModelService
  );

  const body = match(eventType)
    .with("TenantVerifiedAttributeAssigned", () =>
      inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "verificato",
        assignerOrRevokerName
      )
    )
    .with("TenantVerifiedAttributeRevoked", () =>
      inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "verificato",
        assignerOrRevokerName
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

async function getAttributeAssignerOrRevokerName(
  eventType: VerifiedAttributeAssignedRevokedEventType,
  tenant: Tenant,
  attribute: Attribute,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  return match(eventType)
    .with("TenantVerifiedAttributeAssigned", async () => {
      const tenantAttribute = tenant.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
      );
      if (!tenantAttribute || tenantAttribute.verifiedBy.length === 0) {
        throw verifiedAttributeNotFoundInTenant(tenant.id, attribute.id);
      }
      const tenantId = [...tenantAttribute.verifiedBy].sort(
        (a, b) => b.verificationDate.getTime() - a.verificationDate.getTime()
      )[0].id;
      return (await retrieveTenant(tenantId, readModelService)).name;
    })
    .with("TenantVerifiedAttributeRevoked", async () => {
      const tenantAttribute = tenant.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
      );
      if (!tenantAttribute || tenantAttribute.revokedBy.length === 0) {
        throw verifiedAttributeNotFoundInTenant(tenant.id, attribute.id);
      }
      const tenantId = [...tenantAttribute.revokedBy].sort(
        (a, b) => b.revocationDate.getTime() - a.revocationDate.getTime()
      )[0].id;
      return (await retrieveTenant(tenantId, readModelService)).name;
    })
    .exhaustive();
}
