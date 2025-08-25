import { z } from "zod";
import { PurposeTemplate } from "../purpose-template/purposeTemplate.js";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
} from "../risk-analysis/riskAnalysisTemplate.js";

export const RiskAnalysisTemplateAnswerAnnotationDocumentReadModel =
  RiskAnalysisTemplateAnswerAnnotationDocument.extend({
    createdAt: z.string().datetime(),
  });
export type RiskAnalysisTemplateAnswerAnnotationDocumentReadmodel = z.infer<
  typeof RiskAnalysisTemplateAnswerAnnotationDocumentReadModel
>;

export const RiskAnalysisTemplateAnswerAnnotationReadModel =
  RiskAnalysisTemplateAnswerAnnotation.extend({
    docs: z.array(RiskAnalysisTemplateAnswerAnnotationDocumentReadModel),
  });
export type RiskAnalysisTemplateAnswerAnnotationReadModel = z.infer<
  typeof RiskAnalysisTemplateAnswerAnnotationReadModel
>;

export const RiskAnalysisTemplateSingleAnswerReadModel =
  RiskAnalysisTemplateSingleAnswer.extend({
    annotation: RiskAnalysisTemplateAnswerAnnotationReadModel.optional(),
  });
export type RiskAnalysisTemplateSingleAnswerReadModel = z.infer<
  typeof RiskAnalysisTemplateSingleAnswerReadModel
>;

export const RiskAnalysisTemplateMultiAnswerReadModel =
  RiskAnalysisTemplateMultiAnswer.extend({
    annotation: RiskAnalysisTemplateAnswerAnnotationReadModel.optional(),
  });

export type RiskAnalysisTemplateMultiAnswerReadModel = z.infer<
  typeof RiskAnalysisTemplateMultiAnswerReadModel
>;

export const RiskAnalysisFormTemplateReadModel =
  RiskAnalysisFormTemplate.extend({
    singleAnswers: z.array(RiskAnalysisTemplateSingleAnswerReadModel),
    multiAnswers: z.array(RiskAnalysisTemplateMultiAnswerReadModel),
  });
export type RiskAnalysisFormTemplateReadModel = z.infer<
  typeof RiskAnalysisFormTemplateReadModel
>;

export const PurposeTemplateReadModel = PurposeTemplate.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  purposeRiskAnalysisForm: RiskAnalysisFormTemplateReadModel.optional(),
});

export type PurposeTemplateReadModel = z.infer<typeof PurposeTemplateReadModel>;
