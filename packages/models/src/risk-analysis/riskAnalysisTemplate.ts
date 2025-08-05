import { z } from "zod";
import {
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  RiskAnalysisFormTemplateId,
} from "../brandedIds.js";
import {
  RiskAnalysisSingleAnswer,
  RiskAnalysisMultiAnswer,
} from "./riskAnalysis.js";

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

export const RiskAnalysisTemplateSingleAnswer = RiskAnalysisSingleAnswer.and(
  z.object({
    editable: z.boolean(),
    annotation: RiskAnalysisTemplateAnswerAnnotation.optional(),
    assistiveText: z.string().optional(),
    suggestedValues: z.array(z.string()),
  })
);
export type RiskAnalysisTemplateSingleAnswer = z.infer<
  typeof RiskAnalysisTemplateSingleAnswer
>;

export const RiskAnalysisTemplateMultiAnswer = RiskAnalysisMultiAnswer.and(
  z.object({
    editable: z.boolean(),
    annotation: RiskAnalysisTemplateAnswerAnnotation.optional(),
    assistiveText: z.string().optional(),
  })
);
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
