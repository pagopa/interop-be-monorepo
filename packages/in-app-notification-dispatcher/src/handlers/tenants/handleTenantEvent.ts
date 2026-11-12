import { Logger } from "pagopa-interop-commons";
import {
  AttributeId,
  fromTenantV2,
  fromTenantV3,
  NewNotification,
  TenantEventEnvelope,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleCertifiedAttributeAssignedToAssignee } from "./handleCertifiedAttributeAssignedToAssignee.js";
import { handleCertifiedAttributeRevokedToAssignee } from "./handleCertifiedAttributeRevokedToAssignee.js";
import { handleCertifiedDiscreteAttributeAssignedToAssignee } from "./handleCertifiedDiscreteAttributeAssignedToAssignee.js";
import { handleCertifiedDiscreteAttributeRevokedToAssignee } from "./handleCertifiedDiscreteAttributeRevokedToAssignee.js";
import { handleCertifiedDiscreteAttributeUpdatedToAssignee } from "./handleCertifiedDiscreteAttributeUpdatedToAssignee.js";
import { handleVerifiedAttributeAssignedToAssignee } from "./handleVerifiedAttributeAssignedToAssignee.js";
import { handleVerifiedAttributeRevokedToAssignee } from "./handleVerifiedAttributeRevokedToAssignee.js";

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
      { event_version: 2, type: "TenantCertifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedAttributeAssignedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedAttributeRevokedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedDiscreteAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeAssignedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedDiscreteAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeRevokedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedDiscreteAttributeUpdated" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeUpdatedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantVerifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleVerifiedAttributeAssignedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantVerifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleVerifiedAttributeRevokedToAssignee(
          tenant && fromTenantV2(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      {
        event_version: 2,
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
          "TenantRemoteIdAssigned",
          "MaintenanceTenantRemoteIdDeleted"
        ),
      },
      () => {
        logger.info(
          `Skipping in-app notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .with(
      { event_version: 3, type: "TenantCertifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedAttributeAssignedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 3, type: "TenantCertifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedAttributeRevokedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 3, type: "TenantCertifiedDiscreteAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeAssignedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 3, type: "TenantCertifiedDiscreteAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeRevokedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 3, type: "TenantCertifiedDiscreteAttributeUpdated" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeUpdatedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 3, type: "TenantVerifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleVerifiedAttributeAssignedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 3, type: "TenantVerifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleVerifiedAttributeRevokedToAssignee(
          tenant && fromTenantV3(tenant),
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      {
        event_version: 3,
        type: P.union(
          "TenantOnboarded",
          "TenantOnboardDetailsUpdated",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantVerifiedAttributeExpirationUpdated",
          "TenantVerifiedAttributeExtensionUpdated",
          "MaintenanceTenantDeleted",
          "MaintenanceTenantUpdated",
          "TenantContactAdded",
          "TenantKindUpdated",
          "TenantContactDeleted",
          "MaintenanceTenantPromotedToCertifier",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved",
          "TenantRemoteIdAssigned",
          "MaintenanceTenantRemoteIdDeleted"
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
