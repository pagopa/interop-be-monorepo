import {
  AttributeId,
  NewNotification,
  TenantEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleCertifiedVerifiedAttributeAssignedRevokedToAssignee } from "./handleCertifiedVerifiedAttributeAssignedRevokedToAssignee.js";

export async function handleTenantEvent(
  decodedMessage: TenantEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "TenantCertifiedAttributeAssigned",
          "TenantCertifiedAttributeRevoked",
          "TenantVerifiedAttributeAssigned",
          "TenantVerifiedAttributeRevoked"
        ),
      },
      ({ data: { tenant, attributeId }, type }) =>
        handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
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
          "TenantDelegatedConsumerFeatureRemoved"
        ),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
