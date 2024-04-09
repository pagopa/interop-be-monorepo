import {
  PurposeStateV1,
  PurposeV1,
  PurposeVersionDocumentV1,
  PurposeVersionV1,
} from "../gen/v1/purpose/purpose.js";
import { RiskAnalysisId, unsafeBrandId } from "../brandedIds.js";
import { PurposeRiskAnalysisForm } from "../risk-analysis/riskAnalysis.js";
import { PurposeRiskAnalysisFormV1 } from "../gen/v1/purpose/riskAnalysis.js";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  purposeVersionState,
} from "./purpose.js";

export const fromPurposeVersionStateV1 = (
  input: PurposeStateV1
): PurposeVersionState => {
  switch (input) {
    case PurposeStateV1.DRAFT:
      return purposeVersionState.draft;
    case PurposeStateV1.ACTIVE:
      return purposeVersionState.active;
    case PurposeStateV1.SUSPENDED:
      return purposeVersionState.suspended;
    case PurposeStateV1.ARCHIVED:
      return purposeVersionState.archived;
    case PurposeStateV1.WAITING_FOR_APPROVAL:
      return purposeVersionState.waitingForApproval;
    case PurposeStateV1.REJECTED:
      return purposeVersionState.rejected;
    case PurposeStateV1.UNSPECIFIED$: {
      throw new Error("Unspecified purpose version state");
    }
  }
};

export const fromPurposeVersionDocumentV1 = (
  input: PurposeVersionDocumentV1
): PurposeVersionDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(Number(input.createdAt)),
});

export const fromPurposeVersionV1 = (
  input: PurposeVersionV1
): PurposeVersion => ({
  ...input,
  id: unsafeBrandId(input.id),
  state: fromPurposeVersionStateV1(input.state),
  expectedApprovalDate: input.expectedApprovalDate
    ? new Date(Number(input.expectedApprovalDate))
    : undefined,
  riskAnalysis: input.riskAnalysis
    ? fromPurposeVersionDocumentV1(input.riskAnalysis)
    : undefined,
  createdAt: new Date(Number(input.createdAt)),
  updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  firstActivationAt: input.firstActivationAt
    ? new Date(Number(input.firstActivationAt))
    : undefined,
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
});

export const fromPurposeRiskAnalysisFormV1 = (
  input: PurposeRiskAnalysisFormV1
): PurposeRiskAnalysisForm => ({
  ...input,
  id: unsafeBrandId(input.id),
  riskAnalysisId: input.riskAnalysisId
    ? unsafeBrandId<RiskAnalysisId>(input.riskAnalysisId)
    : undefined,
  singleAnswers: input.singleAnswers.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  multiAnswers: input.multiAnswers.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
});

export const fromPurposeV1 = (input: PurposeV1): Purpose => ({
  ...input,
  id: unsafeBrandId(input.id),
  eserviceId: unsafeBrandId(input.eserviceId),
  consumerId: unsafeBrandId(input.consumerId),
  versions: input.versions.map(fromPurposeVersionV1),
  isFreeOfCharge: input.isFreeOfCharge || true,
  createdAt: new Date(Number(input.createdAt)),
  updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  riskAnalysisForm: input.riskAnalysisForm
    ? fromPurposeRiskAnalysisFormV1(input.riskAnalysisForm)
    : undefined,
});
