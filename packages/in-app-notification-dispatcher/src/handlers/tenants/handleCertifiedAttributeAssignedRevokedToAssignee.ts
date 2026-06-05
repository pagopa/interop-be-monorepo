import {
  AttributeId,
  Attribute,
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
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { attributeOriginUndefined } from "../../models/errors.js";

type CertifiedAttributeAssignedRevokedEventType =
  | "TenantCertifiedAttributeAssigned"
  | "TenantCertifiedAttributeRevoked";

export async function handleCertifiedAttributeAssignedRevokedToAssignee(
  tenantV2Msg: TenantV2 | undefined,
  attributeId: AttributeId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: CertifiedAttributeAssignedRevokedEventType
): Promise<NewNotification[]> {
  if (!tenantV2Msg) {
    throw missingKafkaMessageDataError("tenant", eventType);
  }
  logger.info(
    `Sending in-app notification for handleCertifiedAttributeAssignedRevokedToAssignee - entityId: ${tenantV2Msg.id}, eventType: ${eventType}`
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
      `No users with notifications enabled for handleCertifiedAttributeAssignedRevokedToAssignee - entityId: ${tenant.id}, eventType: ${eventType}`
    );
    return [];
  }

  const attribute = await retrieveAttribute(attributeId, readModelService);

  const assignerOrRevokerName = await getAttributeAssignerOrRevokerName(
    eventType,
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
  eventType: CertifiedAttributeAssignedRevokedEventType,
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
    .exhaustive();
}
