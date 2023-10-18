import {
  PersistentAgreement,
  PersistentAgreementDocument,
  PersistentAgreementState,
  persistentAgreementState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiAgreement,
  ApiAgreementDocument,
  ApiAgreementState,
} from "./models.js";

export function agreementStateToApiAgreementState(
  input: PersistentAgreementState
): ApiAgreementState {
  return match<PersistentAgreementState, ApiAgreementState>(input)
    .with(persistentAgreementState.pending, () => "PENDING")
    .with(persistentAgreementState.rejected, () => "REJECTED")
    .with(persistentAgreementState.active, () => "ACTIVE")
    .with(persistentAgreementState.suspended, () => "SUSPENDED")
    .with(persistentAgreementState.archived, () => "ARCHIVED")
    .with(persistentAgreementState.draft, () => "DRAFT")
    .with(
      persistentAgreementState.missingCertifiedAttributes,
      () => "MISSING_CERTIFIED_ATTRIBUTES"
    )
    .exhaustive();
}

export const agreementDocumentToApiAgreementDocument = (
  input: PersistentAgreementDocument
): ApiAgreementDocument => ({
  id: input.id,
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: input.createdAt?.toJSON(),
});

export const agreementToApiAgreement = (
  agreement: PersistentAgreement
): ApiAgreement => ({
  id: agreement.id,
  eserviceId: agreement.eserviceId,
  descriptorId: agreement.descriptorId,
  producerId: agreement.producerId,
  consumerId: agreement.consumerId,
  state: agreementStateToApiAgreementState(agreement.state),
  verifiedAttributes: agreement.verifiedAttributes,
  certifiedAttributes: agreement.certifiedAttributes,
  declaredAttributes: agreement.declaredAttributes,
  suspendedByConsumer: agreement.suspendedByConsumer,
  suspendedByProducer: agreement.suspendedByProducer,
  suspendedByPlatform: agreement.suspendedByPlatform,
  consumerNotes: agreement.consumerNotes,
  rejectionReason: agreement.rejectionReason,
  consumerDocuments: agreement.consumerDocuments.map(
    agreementDocumentToApiAgreementDocument
  ),
  createdAt: agreement.createdAt?.toJSON(),
  updatedAt: agreement.updatedAt?.toJSON(),
  contract: agreement.contract
    ? agreementDocumentToApiAgreementDocument(agreement.contract)
    : undefined,
  suspendedAt: agreement.suspendedAt?.toJSON(),
});
