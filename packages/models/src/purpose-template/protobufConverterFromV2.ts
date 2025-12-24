import { unsafeBrandId } from "../brandedIds.js";
import {
  PurposeTemplateStateV2,
  PurposeTemplateV2,
  RiskAnalysisFormTemplateV2,
  RiskAnalysisTemplateAnswerAnnotationDocumentV2,
  RiskAnalysisTemplateAnswerAnnotationV2,
  RiskAnalysisTemplateDocumentV2,
  RiskAnalysisTemplateSignedDocumentV2,
} from "../gen/v2/purpose-template/purpose-template.js";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateDocument,
  RiskAnalysisTemplateSignedDocument,
} from "../risk-analysis-template/riskAnalysisTemplate.js";
import { fromTenantKindV2 } from "../tenant/protobufConverterFromV2.js";
import { bigIntToDate } from "../utils.js";
import {
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
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

export const fromRiskAnalysisTemplateDocumentV2 = (
  input: RiskAnalysisTemplateDocumentV2
  // eslint-disable-next-line sonarjs/no-identical-functions
): RiskAnalysisTemplateDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
});

export const fromRiskAnalysisTemplateSignedDocumentV2 = (
  input: RiskAnalysisTemplateSignedDocumentV2
): RiskAnalysisTemplateSignedDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
  signedAt: bigIntToDate(input.signedAt),
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
  document: input.document
    ? fromRiskAnalysisTemplateDocumentV2(input.document)
    : undefined,
  signedDocument: input.signedDocument
    ? fromRiskAnalysisTemplateSignedDocumentV2(input.signedDocument)
    : undefined,
});

export const fromPurposeTemplateV2 = (
  input: PurposeTemplateV2
): PurposeTemplate => ({
  ...input,
  id: unsafeBrandId(input.id),
  targetTenantKind: fromTenantKindV2(input.targetTenantKind),
  creatorId: unsafeBrandId(input.creatorId),
  state: fromPurposeTemplateStateV2(input.state),
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
  purposeRiskAnalysisForm: input.purposeRiskAnalysisForm
    ? fromPurposeRiskAnalysisFormTemplateV2(input.purposeRiskAnalysisForm)
    : undefined,
});
