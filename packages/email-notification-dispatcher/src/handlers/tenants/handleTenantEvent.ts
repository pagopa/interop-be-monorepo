import {
  AttributeId,
  EmailNotificationMessagePayload,
  TenantEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleTenantCertifiedAttributeAssigned } from "./handleTenantCertifiedAttributeAssigned.js";
import { handleTenantCertifiedAttributeRevoked } from "./handleTenantCertifiedAttributeRevoked.js";
import { handleTenantVerifiedAttributeAssigned } from "./handleTenantVerifiedAttributeAssigned.js";
import { handleTenantVerifiedAttributeRevoked } from "./handleTenantVerifiedAttributeRevoked.js";
import { handleTenantDeclaredAttributeAssigned } from "./handleTenantDeclaredAttributeAssigned.js";
import { handleTenantDeclaredAttributeRevoked } from "./handleTenantDeclaredAttributeRevoked.js";

export async function handleTenantEvent(
  params: HandlerParams<typeof TenantEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with(
      { type: "TenantCertifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleTenantCertifiedAttributeAssigned({
          tenantV2Msg: tenant,
          attributeId: unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "TenantCertifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleTenantCertifiedAttributeRevoked({
          tenantV2Msg: tenant,
          attributeId: unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "TenantVerifiedAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleTenantVerifiedAttributeAssigned({
          tenantV2Msg: tenant,
          attributeId: unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "TenantVerifiedAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleTenantVerifiedAttributeRevoked({
          tenantV2Msg: tenant,
          attributeId: unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "TenantDeclaredAttributeAssigned" },
      ({ data: { tenant, attributeId } }) =>
        handleTenantDeclaredAttributeAssigned({
          tenantV2Msg: tenant,
          attributeId: unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "TenantDeclaredAttributeRevoked" },
      ({ data: { tenant, attributeId } }) =>
        handleTenantDeclaredAttributeRevoked({
          tenantV2Msg: tenant,
          attributeId: unsafeBrandId<AttributeId>(attributeId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      {
        type: P.union(
          "TenantOnboarded",
          "TenantOnboardDetailsUpdated",
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
          `No need to send an email notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
