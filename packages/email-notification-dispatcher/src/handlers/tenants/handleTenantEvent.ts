import {
  AttributeId,
  EmailNotificationMessagePayload,
  fromTenantV2,
  fromTenantV3,
  TenantEventV2,
  TenantEventV3,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import {
  HandlerParams,
  TenantHandlerParams,
} from "../../models/handlerParams.js";
import { handleTenantCertifiedAttributeAssigned } from "./handleTenantCertifiedAttributeAssigned.js";
import { handleTenantCertifiedAttributeRevoked } from "./handleTenantCertifiedAttributeRevoked.js";
import { handleTenantCertifiedDiscreteAttributeAssigned } from "./handleTenantCertifiedDiscreteAttributeAssigned.js";
import { handleTenantCertifiedDiscreteAttributeRevoked } from "./handleTenantCertifiedDiscreteAttributeRevoked.js";
import { handleTenantCertifiedDiscreteAttributeUpdated } from "./handleTenantCertifiedDiscreteAttributeUpdated.js";
import { handleTenantVerifiedAttributeAssigned } from "./handleTenantVerifiedAttributeAssigned.js";
import { handleTenantVerifiedAttributeRevoked } from "./handleTenantVerifiedAttributeRevoked.js";

export async function handleTenantEvent(
  params: HandlerParams<typeof TenantEvent>
): Promise<EmailNotificationMessagePayload[]> {
  const { decodedMessage, ...commonParams } = params;

  function handleAttribute(
    message: Extract<
      TenantEventV2 | TenantEventV3,
      { data: { attributeId: string } }
    >,
    handler: (
      params: TenantHandlerParams
    ) => Promise<EmailNotificationMessagePayload[]>
  ): Promise<EmailNotificationMessagePayload[]> {
    const tenant =
      message.event_version === 2
        ? message.data.tenant && fromTenantV2(message.data.tenant)
        : message.data.tenant && fromTenantV3(message.data.tenant);
    return handler({
      ...commonParams,
      tenant,
      attributeId: unsafeBrandId<AttributeId>(message.data.attributeId),
    });
  }

  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      commonParams.logger.info(
        `Skipping V1 event ${decodedMessage.type} message`
      );
      return [];
    })
    .with({ type: "TenantCertifiedAttributeAssigned" }, (message) =>
      handleAttribute(message, handleTenantCertifiedAttributeAssigned)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeAssigned" }, (message) =>
      handleAttribute(message, handleTenantCertifiedDiscreteAttributeAssigned)
    )
    .with({ type: "TenantCertifiedAttributeRevoked" }, (message) =>
      handleAttribute(message, handleTenantCertifiedAttributeRevoked)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeRevoked" }, (message) =>
      handleAttribute(message, handleTenantCertifiedDiscreteAttributeRevoked)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeUpdated" }, (message) =>
      handleAttribute(message, handleTenantCertifiedDiscreteAttributeUpdated)
    )
    .with({ type: "TenantVerifiedAttributeAssigned" }, (message) =>
      handleAttribute(message, handleTenantVerifiedAttributeAssigned)
    )
    .with({ type: "TenantVerifiedAttributeRevoked" }, (message) =>
      handleAttribute(message, handleTenantVerifiedAttributeRevoked)
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
          "TenantContactAdded",
          "TenantKindUpdated",
          "TenantMailDeleted",
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
        commonParams.logger.info(
          `Skipping email notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .exhaustive();
}
