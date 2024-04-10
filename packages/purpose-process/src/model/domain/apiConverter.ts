import { match } from "ts-pattern";
import {
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  ApiPurpose,
  ApiPurposeVersion,
  ApiPurposeVersionDocument,
  ApiPurposeVersionState,
  ApiRiskAnalysisForm,
} from "./models.js";

export const riskAnalysisFormToApiRiskAnalysisForm = (
  riskAnalysisForm: PurposeRiskAnalysisForm
): ApiRiskAnalysisForm => ({
  version: riskAnalysisForm.version,
  riskAnalysisId: riskAnalysisForm.riskAnalysisId,
});

export const purposeVersionDocumentToApiPurposeVersionDocument = (
  document: PurposeVersionDocument
): ApiPurposeVersionDocument => ({
  id: document.id,
  contentType: document.contentType,
  path: document.path,
  createdAt: document.createdAt.toJSON(),
});

export const purposeVersionStateToApiPurposeVersionState = (
  state: PurposeVersionState
): ApiPurposeVersionState =>
  match<PurposeVersionState, ApiPurposeVersionState>(state)
    .with(purposeVersionState.active, () => "ACTIVE")
    .with(purposeVersionState.archived, () => "ARCHIVED")
    .with(purposeVersionState.draft, () => "DRAFT")
    .with(purposeVersionState.rejected, () => "WAITING_FOR_APPROVAL") // TODO this should be "REJECTED" but it's not in the api spec yet
    .with(purposeVersionState.suspended, () => "SUSPENDED")
    .with(purposeVersionState.waitingForApproval, () => "WAITING_FOR_APPROVAL")
    .exhaustive();

export const purposeVersionToApiPurposeVersion = (
  version: PurposeVersion
): ApiPurposeVersion => ({
  id: version.id,
  state: purposeVersionStateToApiPurposeVersionState(version.state),
  createdAt: version.createdAt.toJSON(),
  updatedAt: version.updatedAt?.toJSON(),
  firstActivationAt: version.firstActivationAt?.toJSON(),
  expectedApprovalDate: version.expectedApprovalDate?.toJSON(),
  riskAnalysis: version.riskAnalysis
    ? purposeVersionDocumentToApiPurposeVersionDocument(version.riskAnalysis)
    : undefined,
  dailyCalls: version.dailyCalls,
  suspendedAt: version.suspendedAt?.toJSON(),
});

export const purposeToApiPurpose = (
  purpose: Purpose,
  isRiskAnalysisValid: boolean
): ApiPurpose => ({
  id: purpose.id,
  eserviceId: purpose.eserviceId,
  consumerId: purpose.consumerId,
  versions: purpose.versions.map(purposeVersionToApiPurposeVersion),
  suspendedByConsumer: purpose.suspendedByConsumer,
  suspendedByProducer: purpose.suspendedByProducer,
  title: purpose.title,
  description: purpose.description,
  riskAnalysisForm: purpose.riskAnalysisForm
    ? riskAnalysisFormToApiRiskAnalysisForm(purpose.riskAnalysisForm)
    : undefined,
  createdAt: purpose.createdAt?.toJSON(),
  updatedAt: purpose.updatedAt?.toJSON(),
  isRiskAnalysisValid,
  isFreeOfCharge: purpose.isFreeOfCharge,
  freeOfChargeReason: purpose.freeOfChargeReason,
});
