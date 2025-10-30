import { describe, expect, it } from "vitest";
import { TenantKind, tenantKind } from "pagopa-interop-models";
import {
  incompatiblePurposeTemplatePersonalDataError,
  malformedRiskAnalysisTemplateFieldValueOrSuggestionError,
  missingExpectedRiskAnalysisTemplateFieldError,
  noRiskAnalysisTemplateRulesVersionFoundError,
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  unexpectedRiskAnalysisTemplateDependencyValueError,
  unexpectedRiskAnalysisTemplateFieldError,
  unexpectedRiskAnalysisTemplateFieldValueError,
  unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError,
  unexpectedRiskAnalysisTemplateRulesVersionError,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  getMockValidRiskAnalysisFormTemplate,
  validatedRiskAnalysisTemplate2_0_Private,
  validatedRiskAnalysisTemplate3_1_Pa,
} from "../src/riskAnalysisTemplateTestUtils.js";

describe("Risk Analysis Template Validation", () => {
  const TEST_FIELDS = {
    INSTITUTIONAL_PURPOSE: "institutionalPurpose",
    DELIVERY_METHOD: "deliveryMethod",
    PURPOSE: "purpose",
    OTHER_PURPOSE: "otherPurpose",
  } as const;

  const PURPOSE_VALUES = {
    INSTITUTIONAL: "INSTITUTIONAL",
    OTHER: "OTHER",
  } as const;

  const PURPOSE_ALLOWED_VALUES = new Set(Object.values(PURPOSE_VALUES));

  function createValidTemplate(
    tenantKind: TenantKind
  ): ReturnType<
    typeof riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate
  > {
    const mockForm = getMockValidRiskAnalysisFormTemplate(tenantKind);
    return riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
      mockForm
    );
  }

  function createTemplateWithModifiedField(
    template: ReturnType<typeof createValidTemplate>,
    fieldName: string,
    modifications: Partial<{
      editable: boolean;
      values: string[];
      suggestedValues: string[];
    }>
  ): ReturnType<typeof createValidTemplate> {
    const { answers } = template;
    const field = answers[fieldName];

    if (!field) {
      throw new Error(`Field ${fieldName} not found in template`);
    }

    const modifiedAnswers = {
      ...answers,
      [fieldName]: {
        ...field,
        ...modifications,
      },
    };

    return {
      ...template,
      answers: modifiedAnswers,
    };
  }

  function createTemplateWithoutField(
    template: ReturnType<typeof createValidTemplate>,
    fieldName: string
  ): ReturnType<typeof createValidTemplate> {
    const { answers } = template;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [fieldName]: _, ...remainingAnswers } = answers;

    return {
      ...template,
      answers: remainingAnswers,
    };
  }

  function createTemplateWithUnexpectedField(
    template: ReturnType<typeof createValidTemplate>,
    fieldName: string,
    fieldValue: string
  ): ReturnType<typeof createValidTemplate> {
    const unexpectedField = {
      values: [fieldValue],
      editable: false,
      suggestedValues: [],
    };

    return {
      ...template,
      answers: {
        ...template.answers,
        [fieldName]: unexpectedField,
      },
    };
  }

  it("should succeed on correct form 3.1 on tenant kind PA", () => {
    const template = createValidTemplate(tenantKind.PA);
    const result = validatePurposeTemplateRiskAnalysis(
      template,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysisTemplate3_1_Pa,
    });
  });

  it("should succeed on correct form 2.0 on tenant kind PRIVATE", () => {
    const template = createValidTemplate(tenantKind.PRIVATE);
    const result = validatePurposeTemplateRiskAnalysis(
      template,
      tenantKind.PRIVATE,
      true
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysisTemplate2_0_Private,
    });
  });

  it("should throw incompatiblePurposeTemplatePersonalDataError if the purpose template and the risk analysis answer personal data flags do not match", () => {
    const template = createValidTemplate(tenantKind.PA);
    const result = validatePurposeTemplateRiskAnalysis(
      template,
      tenantKind.PA,
      false
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        incompatiblePurposeTemplatePersonalDataError(
          template.answers.usesPersonalData?.values[0] === "YES",
          false
        ),
      ],
    });
  });

  it("should throw noRulesVersionTemplateFoundError if the tenant kind is not valid", async () => {
    const invalidTenantKind = "invalidTenantKind" as TenantKind;
    const emptyTemplate = { version: "1.0", answers: {} };

    const result = validatePurposeTemplateRiskAnalysis(
      emptyTemplate,
      invalidTenantKind,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [noRiskAnalysisTemplateRulesVersionFoundError(invalidTenantKind)],
    });
  });

  it("should throw unexpectedTemplateRulesVersionError if the version is not valid", () => {
    const emptyTemplate = { version: "1.0", answers: {} };

    const result = validatePurposeTemplateRiskAnalysis(
      emptyTemplate,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        unexpectedRiskAnalysisTemplateRulesVersionError(emptyTemplate.version),
      ],
    });
  });

  it("should throw missingExpectedTemplateFieldError if one single answer field is missing", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithoutField = createTemplateWithoutField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithoutField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        missingExpectedRiskAnalysisTemplateFieldError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw malformedTemplateFieldValueOrSuggestionError if freeText field has editable: true", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidFreeText = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE,
      { editable: true }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidFreeText,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw malformedTemplateFieldValueOrSuggestionError if freeText field does not have suggestions", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidFreeText = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE,
      { suggestedValues: [] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidFreeText,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw malformedTemplateFieldValueOrSuggestionError if freeText field has values", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidFreeText = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE,
      { values: ["value"] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidFreeText,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw unexpectedTemplateFieldValueOrSuggestionError if non-editable not freeText field has suggestions", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidField = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.DELIVERY_METHOD,
      { suggestedValues: ["suggestion"] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.DELIVERY_METHOD
        ),
      ],
    });
  });

  it("should throw unexpectedTemplateFieldValueOrSuggestionError if non-editable not freeText field has no values", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidField = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.DELIVERY_METHOD,
      { values: [] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.DELIVERY_METHOD
        ),
      ],
    });
  });

  it("should throw malformedTemplateFieldValueOrSuggestionError if not freeText field is editable and has values", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithEditableField = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE,
      { editable: true, values: ["value"], suggestedValues: [] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithEditableField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw malformedTemplateFieldValueOrSuggestionError if freeText field does not have values and suggestions", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidFreeText = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE,
      { values: [], suggestedValues: [] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidFreeText,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw malformedTemplateFieldValueOrSuggestionError if freeText field has values and suggestions", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidFreeText = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.INSTITUTIONAL_PURPOSE,
      { suggestedValues: ["suggestion"] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidFreeText,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE
        ),
      ],
    });
  });

  it("should throw unexpectedTemplateFieldValueOrSuggestionError if not freeText field has suggestions and no values", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidField = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.DELIVERY_METHOD,
      { values: [], suggestedValues: ["suggestion"] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.DELIVERY_METHOD
        ),
      ],
    });
  });

  it("should throw unexpectedTemplateFieldValueOrSuggestionError if not freeText field has no suggestions and no values", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithInvalidField = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.DELIVERY_METHOD,
      { values: [], suggestedValues: [] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithInvalidField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(
          TEST_FIELDS.DELIVERY_METHOD
        ),
      ],
    });
  });

  it("should throw unexpectedTemplateFieldError if one field is unexpected", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithUnexpectedField = createTemplateWithUnexpectedField(
      template,
      "unexpectedField",
      "unexpectedValue"
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithUnexpectedField,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [unexpectedRiskAnalysisTemplateFieldError("unexpectedField")],
    });
  });

  it("should throw unexpectedTemplateDependencyValueError and unexpectedTemplateFieldValueError when a dependency field has wrong value", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithWrongDependencyValue = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.PURPOSE,
      { values: ["wrongValue"] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithWrongDependencyValue,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "invalid",
      issues: [
        // wrongValue not in allowed values for purpose field
        unexpectedRiskAnalysisTemplateFieldValueError(
          TEST_FIELDS.PURPOSE,
          PURPOSE_ALLOWED_VALUES
        ),
        // wrongValue not the expected value for institutional purpose field
        unexpectedRiskAnalysisTemplateDependencyValueError(
          TEST_FIELDS.INSTITUTIONAL_PURPOSE,
          TEST_FIELDS.PURPOSE,
          PURPOSE_VALUES.INSTITUTIONAL
        ),
      ],
    });
  });

  it("should throw missingExpectedTemplateFieldError when a field is missing", () => {
    const template = createValidTemplate(tenantKind.PA);
    const templateWithWrongDependencyValue = createTemplateWithModifiedField(
      template,
      TEST_FIELDS.PURPOSE,
      { values: ["OTHER"] }
    );

    const result = validatePurposeTemplateRiskAnalysis(
      templateWithWrongDependencyValue,
      tenantKind.PA,
      true
    );

    // otherPurpose is a missing field that is required if purpose is OTHER
    expect(result).toEqual({
      type: "invalid",
      issues: [missingExpectedRiskAnalysisTemplateFieldError("otherPurpose")],
    });
  });
});
