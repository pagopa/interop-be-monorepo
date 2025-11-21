import { unsafeBrandId } from "../brandedIds.js";
import {
  PurposeTemplateStateV2,
  PurposeTemplateV2,
  RiskAnalysisFormTemplateV2,
  RiskAnalysisTemplateAnswerAnnotationDocumentV2,
  RiskAnalysisTemplateAnswerAnnotationV2,
  TargetTenantKindV2,
} from "../gen/v2/purpose-template/purpose-template.js";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
} from "../risk-analysis-template/riskAnalysisTemplate.js";
import { bigIntToDate } from "../utils.js";
import {
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
  targetTenantKind,
  TargetTenantKind,
} from "./purposeTemplate.js";

export const fromPurposeTemplateStateV2 = (
  input: PurposeTemplateStateV2
): PurposeTemplateState => {
  switch (input) {
    case PurposeTemplateStateV2.DRAFT:
      return purposeTemplateState.draft;
    case PurposeTemplateStateV2.PUBLISHED:
      return purposeTemplateState.published;
    case PurposeTemplateStateV2.SUSPENDED:
      return purposeTemplateState.suspended;
    case PurposeTemplateStateV2.ARCHIVED:
      return purposeTemplateState.archived;
  }
};

export const fromTargetTenantKindV2 = (
  input: TargetTenantKindV2
): TargetTenantKind => {
  switch (input) {
    case TargetTenantKindV2.PA:
      return targetTenantKind.PA;
    case TargetTenantKindV2.PRIVATE:
      return targetTenantKind.PRIVATE;
  }
};

export const fromRiskAnalysisTemplateAnswerAnnotationDocumentV2 = (
  input: RiskAnalysisTemplateAnswerAnnotationDocumentV2
): RiskAnalysisTemplateAnswerAnnotationDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
});

export const fromRiskAnalysisTemplateAnswerAnnotationV2 = (
  input: RiskAnalysisTemplateAnswerAnnotationV2
): RiskAnalysisTemplateAnswerAnnotation => ({
  ...input,
  id: unsafeBrandId(input.id),
  docs: input.docs.map(fromRiskAnalysisTemplateAnswerAnnotationDocumentV2),
});

export const fromPurposeRiskAnalysisFormTemplateV2 = (
  input: RiskAnalysisFormTemplateV2
): RiskAnalysisFormTemplate => ({
  ...input,
  id: unsafeBrandId(input.id),
  singleAnswers: input.singleAnswers.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
    annotation: a.annotation
      ? fromRiskAnalysisTemplateAnswerAnnotationV2(a.annotation)
      : undefined,
  })),
  // eslint-disable-next-line sonarjs/no-identical-functions
  multiAnswers: input.multiAnswers.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
    annotation: a.annotation
      ? fromRiskAnalysisTemplateAnswerAnnotationV2(a.annotation)
      : undefined,
  })),
});

export const fromPurposeTemplateV2 = (
  input: PurposeTemplateV2
): PurposeTemplate => ({
  ...input,
  id: unsafeBrandId(input.id),
  targetTenantKind: fromTargetTenantKindV2(input.targetTenantKind),
  creatorId: unsafeBrandId(input.creatorId),
  state: fromPurposeTemplateStateV2(input.state),
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
  purposeRiskAnalysisForm: input.purposeRiskAnalysisForm
    ? fromPurposeRiskAnalysisFormTemplateV2(input.purposeRiskAnalysisForm)
    : undefined,
});
