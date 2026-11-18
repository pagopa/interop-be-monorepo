import {
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { targetTenantKind } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { getAnnotationDocumentPathsForRemovedAnswers } from "../src/utilities/riskAnalysisDocUtils.js";
import {
  buildRiskAnalysisFormTemplateSeed,
  getMockPurposeTemplateSeed,
} from "./mockUtils.js";

describe("getAnnotationDocumentPathsForRemovedAnswers", () => {
  const singleDocument = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const multiDocument = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const form = getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA);
  const annotatedForm = {
    ...form,
    singleAnswers: [
      {
        ...form.singleAnswers[0],
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [singleDocument],
        },
      },
    ],
    multiAnswers: [
      {
        ...form.multiAnswers[0],
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [multiDocument],
        },
      },
    ],
  };
  const template = {
    ...getMockPurposeTemplate(),
    purposeRiskAnalysisForm: annotatedForm,
  };

  it("collects documents from removed single and multi answers", () => {
    const seed = getMockPurposeTemplateSeed(
      buildRiskAnalysisFormTemplateSeed({
        ...annotatedForm,
        singleAnswers: [],
        multiAnswers: [],
      })
    );

    expect(getAnnotationDocumentPathsForRemovedAnswers(seed, template)).toEqual(
      [singleDocument.path, multiDocument.path]
    );
  });

  it("does not include documents belonging to answers retained in the seed", () => {
    const seed = getMockPurposeTemplateSeed(
      buildRiskAnalysisFormTemplateSeed({
        ...annotatedForm,
        multiAnswers: [],
      })
    );

    expect(getAnnotationDocumentPathsForRemovedAnswers(seed, template)).toEqual(
      [multiDocument.path]
    );
  });

  it("does not schedule cleanup when the seed or original template has no form", () => {
    const seed = getMockPurposeTemplateSeed();
    expect(
      getAnnotationDocumentPathsForRemovedAnswers(
        { ...seed, purposeRiskAnalysisForm: undefined },
        template
      )
    ).toEqual([]);
    expect(
      getAnnotationDocumentPathsForRemovedAnswers(
        seed,
        getMockPurposeTemplate()
      )
    ).toEqual([]);
  });
});
