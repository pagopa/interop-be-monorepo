import { z } from "zod";
import {
  RiskAnalysisFormTemplateId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  RiskAnalysisTemplateDocumentId,
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
  checksum: z.string(),
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

/* 
  This type represents a generic persisted risk analysis template answer,
  which can be either single or multi but its quickly identifiable by the "type" field.
  This is useful when dealing with existent answers in a generic way,
  the approach is similar to RiskAnalysisValidatedSingleOrMultiAnswer.
*/
export const RiskAnalysisTemplateAnswer = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single"),
    answer: RiskAnalysisTemplateSingleAnswer,
  }),
  z.object({
    type: z.literal("multi"),
    answer: RiskAnalysisTemplateMultiAnswer,
  }),
]);
export type RiskAnalysisTemplateAnswer = z.infer<
  typeof RiskAnalysisTemplateAnswer
>;

export const RiskAnalysisTemplateDocument = z.object({
  id: RiskAnalysisTemplateDocumentId,
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
  checksum: z.string(),
});
export type RiskAnalysisTemplateDocument = z.infer<
  typeof RiskAnalysisTemplateDocument
>;

export const RiskAnalysisTemplateSignedDocument =
  RiskAnalysisTemplateDocument.extend({
    signedAt: z.coerce.date(),
  });
export type RiskAnalysisTemplateSignedDocument = z.infer<
  typeof RiskAnalysisTemplateSignedDocument
>;

export const RiskAnalysisFormTemplate = z.object({
  id: RiskAnalysisFormTemplateId,
  version: z.string(),
  singleAnswers: z.array(RiskAnalysisTemplateSingleAnswer),
  multiAnswers: z.array(RiskAnalysisTemplateMultiAnswer),
  riskAnalysisTemplateDocument: RiskAnalysisTemplateDocument.optional(),
  riskAnalysisTemplateSignedDocument:
    RiskAnalysisTemplateSignedDocument.optional(),
});
export type RiskAnalysisFormTemplate = z.infer<typeof RiskAnalysisFormTemplate>;
