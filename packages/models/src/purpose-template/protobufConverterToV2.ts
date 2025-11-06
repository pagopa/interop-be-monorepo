import { match } from "ts-pattern";
import {
  PurposeTemplateStateV2,
  PurposeTemplateV2,
  RiskAnalysisFormTemplateV2,
  RiskAnalysisTemplateAnswerAnnotationDocumentV2,
  RiskAnalysisTemplateAnswerAnnotationV2,
  RiskAnalysisTemplateDocumentV2,
} from "../gen/v2/purpose-template/purpose-template.js";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateDocument,
} from "../risk-analysis-template/riskAnalysisTemplate.js";
import { dateToBigInt } from "../utils.js";
import { toTenantKindV2 } from "../tenant/protobufConverterToV2.js";
import {
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
} from "./purposeTemplate.js";

export const toPurposeTemplateStateV2 = (
  input: PurposeTemplateState
): PurposeTemplateStateV2 =>
  match(input)
    .with(purposeTemplateState.draft, () => PurposeTemplateStateV2.DRAFT)
    .with(
      purposeTemplateState.published,
      () => PurposeTemplateStateV2.PUBLISHED
    )
    .with(
      purposeTemplateState.suspended,
      () => PurposeTemplateStateV2.SUSPENDED
    )
    .with(purposeTemplateState.archived, () => PurposeTemplateStateV2.ARCHIVED)
    .exhaustive();

export const toRiskAnalysisTemplateAnswerAnnotationDocumentV2 = (
  input: RiskAnalysisTemplateAnswerAnnotationDocument
): RiskAnalysisTemplateAnswerAnnotationDocumentV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toRiskAnalysisTemplateAnswerAnnotationV2 = (
  input: RiskAnalysisTemplateAnswerAnnotation
): RiskAnalysisTemplateAnswerAnnotationV2 => ({
  ...input,
  docs: input.docs.map(toRiskAnalysisTemplateAnswerAnnotationDocumentV2),
});

export const toRiskAnalysisTemplateDocumentV2 = (
  input: RiskAnalysisTemplateDocument
): RiskAnalysisTemplateDocumentV2 => ({
  ...input,
  signedAt: input.signedAt ? dateToBigInt(input.signedAt) : undefined,
  createdAt: dateToBigInt(input.createdAt),
});

export const toRiskAnalysisFormTemplateV2 = (
  input: RiskAnalysisFormTemplate
): RiskAnalysisFormTemplateV2 => ({
  ...input,
  singleAnswers: input.singleAnswers.map((a) => ({
    ...a,
    annotation: a.annotation
      ? toRiskAnalysisTemplateAnswerAnnotationV2(a.annotation)
      : undefined,
  })),
  // eslint-disable-next-line sonarjs/no-identical-functions
  multiAnswers: input.multiAnswers.map((a) => ({
    ...a,
    annotation: a.annotation
      ? toRiskAnalysisTemplateAnswerAnnotationV2(a.annotation)
      : undefined,
  })),
  riskAnalysisTemplateDocument: input.riskAnalysisTemplateDocument
    ? toRiskAnalysisTemplateDocumentV2(input.riskAnalysisTemplateDocument)
    : undefined,
});

export const toPurposeTemplateV2 = (
  input: PurposeTemplate
): PurposeTemplateV2 => ({
  ...input,
  targetTenantKind: toTenantKindV2(input.targetTenantKind),
  state: toPurposeTemplateStateV2(input.state),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
  purposeRiskAnalysisForm: input.purposeRiskAnalysisForm
    ? toRiskAnalysisFormTemplateV2(input.purposeRiskAnalysisForm)
    : undefined,
});
