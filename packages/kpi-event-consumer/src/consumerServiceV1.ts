import {
  TenantEventEnvelopeV1,
  PurposeEventEnvelopeV1,
  AgreementEventEnvelopeV1,
  AttributeEventEnvelope,
  EServiceEventEnvelopeV1,
  AuthorizationEventV1,
  AuthorizationEventEnvelopeV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function sendTenantKpiUpdatev1(
  decodedMessage: TenantEventEnvelopeV1,
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "TenantCreated" }, async () => Promise.resolve())
    .with({ type: "TenantDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantUpdated" }, async () => Promise.resolve())
    .with({ type: "SelfcareMappingCreated" }, async () => Promise.resolve())
    .with({ type: "SelfcareMappingDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantMailAdded" }, async () => Promise.resolve())
    .with({ type: "TenantMailDeleted" }, async () => Promise.resolve())
    .exhaustive();
}

export async function sendPurposeKpiUpdatev1(
  message: PurposeEventEnvelopeV1,
): Promise<void> {
  await match(message)
    .with({ type: "PurposeCreated" }, async () => Promise.resolve())
    .with({ type: "PurposeVersionCreated" }, async () => Promise.resolve())
    .with(
      { type: "PurposeUpdated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      { type: "PurposeVersionArchived" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      async () => Promise.resolve(),
    )
    .with({ type: "PurposeVersionUpdated" }, async () => Promise.resolve())
    .with({ type: "PurposeDeleted" }, async () => Promise.resolve())
    .with({ type: "PurposeVersionDeleted" }, async () => Promise.resolve())
    .exhaustive();
}

export async function sendAgreementKpiUpdateV1(
  message: AgreementEventEnvelopeV1,
): Promise<void> {
  await match(message)
    .with({ type: "AgreementAdded" }, async () => Promise.resolve())
    .with({ type: "AgreementDeleted" }, async () => Promise.resolve())
    .with(
      { type: "AgreementUpdated" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "VerifiedAttributeUpdated" },
      async () => Promise.resolve(),
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, async () =>
      Promise.resolve(),
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, async () =>
      Promise.resolve(),
    )
    .with({ type: "AgreementContractAdded" }, async () => Promise.resolve())
    .exhaustive();
}

export async function sendAttributeKpiUpdateV1(
  message: AttributeEventEnvelope,
): Promise<void> {
  await match(message)
    .with({ type: "AttributeAdded" }, async () => Promise.resolve())
    .with({ type: "MaintenanceAttributeDeleted" }, async () =>
      Promise.resolve(),
    )
    .exhaustive();
}

export async function sendCatalogKpiUpdateV1(
  message: EServiceEventEnvelopeV1,
): Promise<void> {
  await match(message)
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      async () => Promise.resolve(),
    )
    .with(
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisUpdated" },
      async () => Promise.resolve(),
    )
    .with({ type: "EServiceWithDescriptorsDeleted" }, async () =>
      Promise.resolve(),
    )
    .with({ type: "EServiceDocumentUpdated" }, async () => Promise.resolve())
    .with({ type: "EServiceDeleted" }, async () => Promise.resolve())
    .with({ type: "EServiceDocumentAdded" }, async () => Promise.resolve())
    .with({ type: "EServiceDocumentDeleted" }, async () => Promise.resolve())
    .with({ type: "EServiceDescriptorAdded" }, async () => Promise.resolve())
    .with({ type: "EServiceDescriptorUpdated" }, async () => Promise.resolve())
    .with({ type: "EServiceRiskAnalysisDeleted" }, async () =>
      Promise.resolve(),
    )
    .exhaustive();
}

export function sendAuthorizationKpiAuthUpdateV1(
  event: AuthorizationEventEnvelopeV1,
): Promise<void> {
  return match(event)
    .with({ type: "KeysAdded" }, async () => Promise.resolve())
    .with({ type: "KeyDeleted" }, async () => Promise.resolve())
    .with({ type: "KeyRelationshipToUserMigrated" }, async () =>
      Promise.resolve(),
    )
    .with({ type: "ClientAdded" }, async () => Promise.resolve())
    .with({ type: "ClientDeleted" }, async () => Promise.resolve())
    .with({ type: "RelationshipAdded" }, async () => Promise.resolve())
    .with({ type: "RelationshipRemoved" }, async () => Promise.resolve())
    .with({ type: "UserAdded" }, async () => Promise.resolve())
    .with({ type: "UserRemoved" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeAdded" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeRemoved" }, async () => Promise.resolve())
    .exhaustive();
}
