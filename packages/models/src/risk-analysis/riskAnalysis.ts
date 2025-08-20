import { z } from "zod";
import {
  RiskAnalysisFormId,
  RiskAnalysisFormTemplateId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "../brandedIds.js";

export const riskAnalysisAnswerKind = {
  single: "SINGLE",
  multi: "MULTI",
} as const;
export const RiskAnalysisAnswerKind = z.enum([
  Object.values(riskAnalysisAnswerKind)[0],
  ...Object.values(riskAnalysisAnswerKind).slice(1),
]);
export type RiskAnalysisAnswerKind = z.infer<typeof RiskAnalysisAnswerKind>;

export const RiskAnalysisSingleAnswer = z.object({
  id: RiskAnalysisSingleAnswerId,
  key: z.string(),
  value: z.string().optional(),
});
export type RiskAnalysisSingleAnswer = z.infer<typeof RiskAnalysisSingleAnswer>;

export const RiskAnalysisMultiAnswer = z.object({
  id: RiskAnalysisMultiAnswerId,
  key: z.string(),
  values: z.array(z.string()),
});
export type RiskAnalysisMultiAnswer = z.infer<typeof RiskAnalysisMultiAnswer>;

export const RiskAnalysisForm = z.object({
  id: RiskAnalysisFormId,
  version: z.string(),
  singleAnswers: z.array(RiskAnalysisSingleAnswer),
  multiAnswers: z.array(RiskAnalysisMultiAnswer),
});
export type RiskAnalysisForm = z.infer<typeof RiskAnalysisForm>;

export const PurposeRiskAnalysisForm = RiskAnalysisForm.and(
  z.object({
    riskAnalysisId: RiskAnalysisId.optional(),
  })
);
export type PurposeRiskAnalysisForm = z.infer<typeof PurposeRiskAnalysisForm>;

export const RiskAnalysis = z.object({
  id: RiskAnalysisId,
  name: z.string(),
  riskAnalysisForm: RiskAnalysisForm,
  createdAt: z.coerce.date(),
});
export type RiskAnalysis = z.infer<typeof RiskAnalysis>;

export const RiskAnalysisTemplateAnswerAnnotationDocument = z.object({
  id: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
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
    assistiveText: z.string().optional(),
    suggestedValues: z.array(z.string()),
  }
);
export type RiskAnalysisTemplateSingleAnswer = z.infer<
  typeof RiskAnalysisTemplateSingleAnswer
>;

export const RiskAnalysisTemplateMultiAnswer = RiskAnalysisMultiAnswer.extend({
  editable: z.boolean(),
  annotation: RiskAnalysisTemplateAnswerAnnotation.optional(),
  assistiveText: z.string().optional(),
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
