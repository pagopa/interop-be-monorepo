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
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { Attribute } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { attributeOriginUndefined } from "../../models/errors.js";

export type CertifiedDiscreteAttributeAssignedRevokedUpdatedEventType =
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

  const assignerOrRevokerOrUpdaterName =
    await getAttributeAssignerOrRevokerOrUpdaterName(
      eventType,
      attribute,
      readModelService
    );

  const body = match(eventType)
    .with("TenantCertifiedDiscreteAttributeAssigned", () =>
      inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "certificato",
        assignerOrRevokerOrUpdaterName
      )
    )
    .with("TenantCertifiedDiscreteAttributeRevoked", () =>
      inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "certificato",
        assignerOrRevokerOrUpdaterName
      )
    )
    .with("TenantCertifiedDiscreteAttributeUpdated", () =>
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

export async function getAttributeAssignerOrRevokerOrUpdaterName(
  eventType: CertifiedDiscreteAttributeAssignedRevokedUpdatedEventType,
  attribute: Attribute,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  return match(eventType)
    .with(
      P.union(
        "TenantCertifiedDiscreteAttributeAssigned",
        "TenantCertifiedDiscreteAttributeRevoked",
        "TenantCertifiedDiscreteAttributeUpdated"
      ),
      async () => {
        if (!attribute.origin) {
          throw attributeOriginUndefined(attribute.id);
        }
        return ["ISTAT"].includes(attribute.origin)
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
