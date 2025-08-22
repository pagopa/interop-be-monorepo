import { describe, expect, it } from "vitest";

import {
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
import { tenantKind } from "pagopa-interop-models";
import {
  getMockValidRiskAnalysisFormTemplate,
  validatedRiskAnalysisTemplate2_0_Private,
  validatedRiskAnalysisTemplate3_0_Pa,
} from "../src/riskAnalysisTestUtils.js";

describe("Risk Analysis Template Validation", () => {
  it("should succeed on correct form 3.0 on tenant kind PA", () => {
    const mockValidRiskAnalysisTemplateForm =
      getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

    const riskAnalysisFormTemplateToValidate =
      riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
        mockValidRiskAnalysisTemplateForm
      );

    const result = validatePurposeTemplateRiskAnalysis(
      riskAnalysisFormTemplateToValidate,
      tenantKind.PA
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysisTemplate3_0_Pa,
    });
  });
  it("should succeed on correct form 2.0 on tenant kind PRIVATE", () => {
    const mockValidRiskAnalysisTemplateForm =
      getMockValidRiskAnalysisFormTemplate(tenantKind.PRIVATE);

    const riskAnalysisFormTemplateToValidate =
      riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
        mockValidRiskAnalysisTemplateForm
      );

    const result = validatePurposeTemplateRiskAnalysis(
      riskAnalysisFormTemplateToValidate,
      tenantKind.PRIVATE
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysisTemplate2_0_Private,
    });
  });
});
