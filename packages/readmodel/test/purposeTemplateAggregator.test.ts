import { describe, expect, it } from "vitest";
import {
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-commons-test/index.js";
import { splitPurposeTemplateIntoObjectsSQL } from "../src/purpose-template/splitters.js";
import { aggregatePurposeTemplate } from "../src/purpose-template/aggregators.js";

describe("Purpose template aggregator", () => {
  it("should convert complete purpose template SQL objects into a business logic purpose template", () => {
    const incompleteRiskAnalysisFormTemplate =
      getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
    const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
      ...incompleteRiskAnalysisFormTemplate,
      singleAnswers: incompleteRiskAnalysisFormTemplate.singleAnswers.map(
        (a): RiskAnalysisTemplateSingleAnswer => ({
          ...a,
          annotation: {
            ...getMockRiskAnalysisTemplateAnswerAnnotation(),
            docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
          },
          suggestedValues: ["a", "b"],
        })
      ),
      multiAnswers: incompleteRiskAnalysisFormTemplate.multiAnswers.map(
        (a): RiskAnalysisTemplateMultiAnswer => ({
          ...a,
          annotation: {
            ...getMockRiskAnalysisTemplateAnswerAnnotation(),
            docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
          },
        })
      ),
    };

    const purposeTemplate: WithMetadata<PurposeTemplate> = {
      data: {
        ...getMockPurposeTemplate(),
        updatedAt: new Date(),
        purposeRiskAnalysisForm: riskAnalysisFormTemplate,
        purposeFreeOfChargeReason: "Free of charge reason",
        purposeDailyCalls: 100,
      },
      metadata: { version: 1 },
    };

    const {
      purposeTemplateSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswersAnnotationsSQL,
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
    } = splitPurposeTemplateIntoObjectsSQL(purposeTemplate.data, 1);

    const aggregatedPurposeTemplate = aggregatePurposeTemplate({
      purposeTemplateSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswersAnnotationsSQL,
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
    });

    expect(aggregatedPurposeTemplate).toStrictEqual(purposeTemplate);
  });

  it("should convert incomplete purpose SQL objects into a business logic purpose template (null -> undefined)", () => {
    const metadataVersion = 1;
    const riskAnalysisFormTemplate = getMockValidRiskAnalysisFormTemplate(
      tenantKind.PA
    );
    const purposeTemplate: WithMetadata<PurposeTemplate> = {
      data: {
        ...getMockPurposeTemplate(),
        purposeRiskAnalysisForm: riskAnalysisFormTemplate,
      },
      metadata: { version: metadataVersion },
    };

    const {
      purposeTemplateSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswersAnnotationsSQL,
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
    } = splitPurposeTemplateIntoObjectsSQL(
      purposeTemplate.data,
      metadataVersion
    );

    const aggregatedPurposeTemplate = aggregatePurposeTemplate({
      purposeTemplateSQL,
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL,
      riskAnalysisTemplateAnswersAnnotationsSQL,
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
    });

    expect(aggregatedPurposeTemplate).toStrictEqual(purposeTemplate);
  });
});
