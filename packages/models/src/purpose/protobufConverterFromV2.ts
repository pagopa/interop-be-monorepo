import { DelegationId, RiskAnalysisId, unsafeBrandId } from "../brandedIds.js";
import {
  PurposeStateV2,
  PurposeVersionDocumentV2,
  PurposeVersionStampV2,
  PurposeVersionV2,
  PurposeV2,
} from "../gen/v2/purpose/purpose.js";
import { PurposeRiskAnalysisFormV2 } from "../gen/v2/purpose/riskAnalysis.js";
import { PurposeRiskAnalysisForm } from "../risk-analysis/riskAnalysis.js";
import { bigIntToDate } from "../utils.js";
import {
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionStamp,
  PurposeVersionState,
  purposeVersionState,
} from "./purpose.js";

export const fromPurposeVersionStateV2 = (
  input: PurposeStateV2
): PurposeVersionState => {
  switch (input) {
    case PurposeStateV2.DRAFT:
      return purposeVersionState.draft;
    case PurposeStateV2.ACTIVE:
      return purposeVersionState.active;
    case PurposeStateV2.SUSPENDED:
      return purposeVersionState.suspended;
    case PurposeStateV2.ARCHIVED:
      return purposeVersionState.archived;
    case PurposeStateV2.WAITING_FOR_APPROVAL:
      return purposeVersionState.waitingForApproval;
    case PurposeStateV2.REJECTED:
      return purposeVersionState.rejected;
  }
};

export const fromPurposeVersionDocumentV2 = (
  input: PurposeVersionDocumentV2
): PurposeVersionDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
});

export const fromPurposeVersionStampV2 = (
  input: PurposeVersionStampV2 | undefined
): PurposeVersionStamp | undefined =>
  input?.creation
    ? {
        creation: {
          who: unsafeBrandId(input.creation.who),
          when: bigIntToDate(input.creation.when),
        },
      }
    : undefined;

export const fromPurposeVersionV2 = (
  input: PurposeVersionV2
): PurposeVersion => ({
  ...input,
  id: unsafeBrandId(input.id),
  state: fromPurposeVersionStateV2(input.state),
  riskAnalysis: input.riskAnalysis
    ? fromPurposeVersionDocumentV2(input.riskAnalysis)
    : undefined,
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
  firstActivationAt: bigIntToDate(input.firstActivationAt),
  suspendedAt: bigIntToDate(input.suspendedAt),
  purposeVersionStamp: input.purposeVersionStamp
    ? fromPurposeVersionStampV2(input.purposeVersionStamp)
    : undefined,
});

export const fromPurposeRiskAnalysisFormV2 = (
  input: PurposeRiskAnalysisFormV2
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

export const fromPurposeV2 = (input: PurposeV2): Purpose => ({
  ...input,
  id: unsafeBrandId(input.id),
  eserviceId: unsafeBrandId(input.eserviceId),
  consumerId: unsafeBrandId(input.consumerId),
  versions: input.versions.map(fromPurposeVersionV2),
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
  riskAnalysisForm: input.riskAnalysisForm
    ? fromPurposeRiskAnalysisFormV2(input.riskAnalysisForm)
    : undefined,
  delegationId: input.delegationId
    ? unsafeBrandId<DelegationId>(input.delegationId)
    : undefined,
});
