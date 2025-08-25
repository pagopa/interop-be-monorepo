import { PurposeTemplate } from "../purpose-template/purposeTemplate.js";
import {
  PurposeTemplateReadModel,
  RiskAnalysisFormTemplateReadModel,
  RiskAnalysisTemplateAnswerAnnotationReadModel,
  RiskAnalysisTemplateSingleAnswerReadModel,
  RiskAnalysisTemplateMultiAnswerReadModel,
  RiskAnalysisTemplateAnswerAnnotationDocumentReadmodel,
} from "../read-models/purposeTemplateReadModel.js";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
} from "../risk-analysis/riskAnalysisTemplate.js";

export const toRiskAnalysisTemplateAnswerAnnotationDocumentsReadModel = (
  docs: RiskAnalysisTemplateAnswerAnnotationDocument[]
): RiskAnalysisTemplateAnswerAnnotationDocumentReadmodel[] =>
  docs.map((doc) => ({
    ...doc,
    createdAt: doc.createdAt.toISOString(),
  }));

export const toRiskAnalysisTemplateAnswerAnnotationReadModel = (
  annotation: RiskAnalysisTemplateAnswerAnnotation | undefined
): RiskAnalysisTemplateAnswerAnnotationReadModel | undefined =>
  annotation
    ? {
        ...annotation,
        docs: toRiskAnalysisTemplateAnswerAnnotationDocumentsReadModel(
          annotation.docs
        ),
      }
    : undefined;

export const toRiskAnalysisSingleAnswerReadModel = (
  riskAnalysisSingleAnswer: RiskAnalysisTemplateSingleAnswer
): RiskAnalysisTemplateSingleAnswerReadModel => ({
  ...riskAnalysisSingleAnswer,
  annotation: toRiskAnalysisTemplateAnswerAnnotationReadModel(
    riskAnalysisSingleAnswer.annotation
  ),
});

export const toRiskAnalysisMultiAnswerReadModel = (
  riskAnalysisMultiAnswer: RiskAnalysisTemplateMultiAnswer
): RiskAnalysisTemplateMultiAnswerReadModel => ({
  ...riskAnalysisMultiAnswer,
  annotation: toRiskAnalysisTemplateAnswerAnnotationReadModel(
    riskAnalysisMultiAnswer.annotation
  ),
});

export const toRiskAnalysisTemplateReadModel = (
  riskAnalysis: RiskAnalysisFormTemplate | undefined
): RiskAnalysisFormTemplateReadModel | undefined =>
  riskAnalysis
    ? {
        ...riskAnalysis,
        singleAnswers: riskAnalysis.singleAnswers.map(
          toRiskAnalysisSingleAnswerReadModel
        ),
        multiAnswers: riskAnalysis.multiAnswers.map(
          toRiskAnalysisMultiAnswerReadModel
        ),
      }
    : undefined;

export const toPurposeTemplateReadModel = (
  purposeTemplate: PurposeTemplate
): PurposeTemplateReadModel => ({
  ...purposeTemplate,
  createdAt: purposeTemplate.createdAt.toISOString(),
  updatedAt: purposeTemplate.updatedAt
    ? purposeTemplate.updatedAt.toISOString()
    : undefined,
  purposeRiskAnalysisForm: toRiskAnalysisTemplateReadModel(
    purposeTemplate.purposeRiskAnalysisForm
  ),
});
