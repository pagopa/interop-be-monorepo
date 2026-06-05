import {
  AttributeId,
  NewNotification,
  TenantEventEnvelope,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleCertifiedAttributeAssignedRevokedToAssignee } from "./handleCertifiedAttributeAssignedRevokedToAssignee.js";
import { handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee } from "./handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee.js";
import { handleVerifiedAttributeAssignedRevokedToAssignee } from "./handleVerifiedAttributeAssignedRevokedToAssignee.js";

export async function handleTenantEvent(
  decodedMessage: TenantEventEnvelope,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      logger.info(`Skipping V1 event ${decodedMessage.type} message`);
      return [];
    })
    .with(
      {
        type: P.union(
          "TenantCertifiedAttributeAssigned",
          "TenantCertifiedAttributeRevoked"
        ),
      },
      ({ data: { tenant, attributeId }, type }) =>
        handleCertifiedAttributeAssignedRevokedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union(
          "TenantCertifiedDiscreteAttributeAssigned",
          "TenantCertifiedDiscreteAttributeRevoked",
          "TenantCertifiedDiscreteAttributeUpdated"
        ),
      },
      ({ data: { tenant, attributeId }, type }) =>
        handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union(
          "TenantVerifiedAttributeAssigned",
          "TenantVerifiedAttributeRevoked"
        ),
      },
      ({ data: { tenant, attributeId }, type }) =>
        handleVerifiedAttributeAssignedRevokedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union(
          "TenantOnboarded",
          "TenantOnboardDetailsUpdated",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantVerifiedAttributeExpirationUpdated",
          "TenantVerifiedAttributeExtensionUpdated",
          "MaintenanceTenantDeleted",
          "MaintenanceTenantUpdated",
          "TenantMailAdded",
          "TenantKindUpdated",
          "TenantMailDeleted",
          "MaintenanceTenantPromotedToCertifier",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved",
          "TenantRemoteIdAssigned"
        ),
      },
      () => {
        logger.info(
          `Skipping in-app notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .exhaustive();
}
