import {
  AgreementEventEnvelopeV2,
  AuthorizationEventEnvelopeV2,
  DelegationEventEnvelopeV2,
  EServiceEventEnvelopeV2,
  PurposeEventEnvelopeV2,
  TenantEventV2,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export async function sendTenantAnalyticsUpdatev2(
  decodedMessage: TenantEventV2
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "MaintenanceTenantDeleted" }, async () => Promise.resolve())
    .with(
      {
        type: P.union(
          "TenantOnboarded",
          "TenantOnboardDetailsUpdated",
          "TenantCertifiedAttributeAssigned",
          "TenantCertifiedAttributeRevoked",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantVerifiedAttributeAssigned",
          "TenantVerifiedAttributeRevoked",
          "TenantVerifiedAttributeExpirationUpdated",
          "TenantVerifiedAttributeExtensionUpdated",
          "TenantMailAdded",
          "MaintenanceTenantPromotedToCertifier",
          "MaintenanceTenantUpdated",
          "TenantMailDeleted",
          "TenantKindUpdated",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved"
        ),
      },
      async () => Promise.resolve()
    )
    .exhaustive();
}

export async function sendPurposeAnalyticsUpdatev2(
  message: PurposeEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      async () => Promise.resolve()
    )
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionActivated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "PurposeArchived" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeCloned" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

export async function sendAgreementAnalyticsUpdateV2(
  message: AgreementEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with({ type: "AgreementDeleted" }, async () => Promise.resolve())
    .with(
      { type: "AgreementAdded" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementActivated" },
      { type: "AgreementUpgraded" },
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      { type: "AgreementRejected" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

export async function sendCatalogAnalyticsUpdateV2(
  message: EServiceEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDeleted" }, async () => Promise.resolve())
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorArchived" },
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorSuspended" },
      { type: "EServiceDescriptorInterfaceAdded" },
      { type: "EServiceDescriptorDocumentAdded" },
      { type: "EServiceDescriptorInterfaceUpdated" },
      { type: "EServiceDescriptorDocumentUpdated" },
      { type: "EServiceDescriptorInterfaceDeleted" },
      { type: "EServiceDescriptorDocumentDeleted" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceRiskAnalysisDeleted" },
      { type: "EServiceDescriptionUpdated" },
      { type: "EServiceDescriptorSubmittedByDelegate" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      { type: "EServiceDescriptorAttributesUpdated" },
      { type: "EServiceNameUpdated" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

export async function sendDelegationAnalyticsUpdateV2(
  message: DelegationEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with(
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ProducerDelegationSubmitted" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

export async function sendAuthorizationAnalyticsAuthUpdateV2(
  decodedMessage: AuthorizationEventEnvelopeV2
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "ClientAdded" }, async () => Promise.resolve())
    .with({ type: "ClientDeleted" }, async () => Promise.resolve())
    .with({ type: "ClientKeyAdded" }, async () => Promise.resolve())
    .with({ type: "ClientKeyDeleted" }, async () => Promise.resolve())
    .with({ type: "ClientUserAdded" }, async () => Promise.resolve())
    .with({ type: "ClientUserDeleted" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeAdded" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeRemoved" }, async () => Promise.resolve())
    .with(
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      async () => Promise.resolve()
    )
    .exhaustive();
}
