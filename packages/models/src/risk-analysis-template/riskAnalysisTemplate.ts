import { z } from "zod";
import {
  RiskAnalysisFormTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "../brandedIds.js";
import {
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
} from "../risk-analysis/riskAnalysis.js";

export const RiskAnalysisTemplateAnswerAnnotationDocument = z.object({
  id: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type RiskAnalysisTemplateAnswerAnnotationDocument = z.infer<
  typeof RiskAnalysisTemplateAnswerAnnotationDocument
>;

export const RiskAnalysisTemplateAnswerAnnotation = z.object({
  id: RiskAnalysisTemplateAnswerAnnotationId,
  text: z.string(),
  docs: z.array(RiskAnalysisTemplateAnswerAnnotationDocument),
});
export type RiskAnalysisTemplateAnswerAnnotation = z.infer<
  typeof RiskAnalysisTemplateAnswerAnnotation
>;

export const RiskAnalysisTemplateSingleAnswer = RiskAnalysisSingleAnswer.extend(
  {
    editable: z.boolean(),
    annotation: RiskAnalysisTemplateAnswerAnnotation.optional(),
    suggestedValues: z.array(z.string()),
  }
);
export type RiskAnalysisTemplateSingleAnswer = z.infer<
  typeof RiskAnalysisTemplateSingleAnswer
>;

export const RiskAnalysisTemplateMultiAnswer = RiskAnalysisMultiAnswer.extend({
  editable: z.boolean(),
  annotation: RiskAnalysisTemplateAnswerAnnotation.optional(),
});

export type RiskAnalysisTemplateMultiAnswer = z.infer<
  typeof RiskAnalysisTemplateMultiAnswer
>;

export const RiskAnalysisFormTemplate = z.object({
  id: RiskAnalysisFormTemplateId,
  version: z.string(),
  singleAnswers: z.array(RiskAnalysisTemplateSingleAnswer),
  multiAnswers: z.array(RiskAnalysisTemplateMultiAnswer),
});
export type RiskAnalysisFormTemplate = z.infer<typeof RiskAnalysisFormTemplate>;
