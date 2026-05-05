import {
  Attribute,
  AttributeId,
  fromTenantV2,
  missingKafkaMessageDataError,
  NewNotification,
  Tenant,
  tenantAttributeType,
  TenantV2,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveAttribute,
  retrieveTenant,
  retrieveTenantByCertifierId,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  attributeOriginUndefined,
  verifiedAttributeNotFoundInTenant,
} from "../../models/errors.js";

type CertifiedVerifiedAttributeAssignedRevokedEventType =
  | "TenantCertifiedAttributeAssigned"
  | "TenantCertifiedAttributeRevoked"
  | "TenantVerifiedAttributeAssigned"
  | "TenantVerifiedAttributeRevoked";

export async function handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: CertifiedVerifiedAttributeAssignedRevokedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Sending in-app notification for handleCertifiedVerifiedAttributeAssignedRevokedToAssignee - entityId: ${tenantV2Msg.id}, eventType: ${eventType}`
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
      `No users with notifications enabled for handleCertifiedVerifiedAttributeAssignedRevokedToAssignee - entityId: ${tenant.id}, eventType: ${eventType}`
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
    .with("TenantCertifiedAttributeAssigned", () =>
      inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "certificato",
        assignerOrRevokerName
      )
    )
    .with("TenantCertifiedAttributeRevoked", () =>
      inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "certificato",
        assignerOrRevokerName
      )
    )
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
  eventType: CertifiedVerifiedAttributeAssignedRevokedEventType,
  tenant: Tenant,
  attribute: Attribute,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  return match(eventType)
    .with(
      P.union(
        "TenantCertifiedAttributeAssigned",
        "TenantCertifiedAttributeRevoked"
      ),
      async () => {
        if (!attribute.origin) {
          throw attributeOriginUndefined(attribute.id);
        }
        return ["ANAC", "IPA", "IVASS"].includes(attribute.origin)
          ? attribute.origin
          : (
              await retrieveTenantByCertifierId(
                attribute.origin,
                readModelService
              )
            ).name;
      }
    )
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
