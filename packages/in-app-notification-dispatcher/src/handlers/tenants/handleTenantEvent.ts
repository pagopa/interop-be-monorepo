import { Logger } from "pagopa-interop-commons";
import {
  AttributeId,
  genericInternalError,
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
    .with({ event_version: 3 }, (msg) => {
      throw genericInternalError(
        `Tenant event V3 not supported yet: ${msg.type}`
      );
    })
    .with(
      { event_version: 2, type: "TenantCertifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedAttributeAssignedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedAttributeRevokedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedDiscreteAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeAssignedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedDiscreteAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeRevokedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantCertifiedDiscreteAttributeUpdated" },
      ({ data: { tenant, attributeId } }) =>
        handleCertifiedDiscreteAttributeUpdatedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantVerifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleVerifiedAttributeAssignedToAssignee(
          tenant,
          unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService
        )
    )
    .with(
      { event_version: 2, type: "TenantVerifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleVerifiedAttributeRevokedToAssignee(
          tenant,
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
    .exhaustive();
}
