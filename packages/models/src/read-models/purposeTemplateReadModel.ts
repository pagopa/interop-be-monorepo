import { z } from "zod";
import { PurposeTemplate } from "../purpose-template/purposeTemplate.js";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
} from "../risk-analysis/riskAnalysis.js";

export const RiskAnalysisTemplateAnswerAnnotationDocumentReadlmodel =
  RiskAnalysisTemplateAnswerAnnotationDocument.extend({
    createdAt: z.string().datetime(),
  });

export const RiskAnalysisTemplateAnswerAnnotationReadModel =
  RiskAnalysisTemplateAnswerAnnotation.extend({
    docs: z.array(RiskAnalysisTemplateAnswerAnnotationDocumentReadlmodel),
  });

export const RiskAnalysisTemplateSingleAnswerReadModel = z.intersection(
  RiskAnalysisTemplateSingleAnswer,
  z.object({
    annotation: RiskAnalysisTemplateAnswerAnnotationReadModel.optional(),
  })
);

export const RiskAnalysisTemplateMultiAnswerReadModel = z.intersection(
  RiskAnalysisTemplateMultiAnswer,
  z.object({
    annotation: RiskAnalysisTemplateAnswerAnnotationReadModel.optional(),
  })
);

export const RiskAnalysisFormTemplateReadModel =
  RiskAnalysisFormTemplate.extend({
    singleAnswers: z.array(RiskAnalysisTemplateSingleAnswerReadModel),
    multiAnswers: z.array(RiskAnalysisTemplateMultiAnswerReadModel),
  });

export const PurposeTemplateReadModel = PurposeTemplate.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  purposeRiskAnalysisForm: RiskAnalysisFormTemplateReadModel.optional(),
});

export type PurposeTemplateReadModel = z.infer<typeof PurposeTemplateReadModel>;
