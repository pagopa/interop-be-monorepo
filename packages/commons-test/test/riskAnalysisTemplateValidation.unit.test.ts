import {
  incompatiblePurposeTemplatePersonalDataError,
  malformedRiskAnalysisTemplateFieldValueOrSuggestionError,
  missingExpectedRiskAnalysisTemplateFieldError,
  noRiskAnalysisTemplateRulesVersionFoundError,
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  unexpectedRiskAnalysisTemplateDependencyValueError,
  unexpectedRiskAnalysisTemplateFieldError,
  unexpectedRiskAnalysisTemplateFieldHyperlinkError,
  unexpectedRiskAnalysisTemplateFieldValueError,
  unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError,
  unexpectedRiskAnalysisTemplateRulesVersionError,
  validatePurposeTemplateRiskAnalysis,
  validateRiskAnalysisAnswer,
} from "pagopa-interop-commons";
import { TenantKind, tenantKind } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  getMockValidRiskAnalysisFormTemplate,
  validatedRiskAnalysisTemplate2_1_Private,
  validatedRiskAnalysisTemplate3_2_Pa,
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

  it("should succeed on correct form 3.2 on tenant kind PA", () => {
    const template = createValidTemplate(tenantKind.PA);
    const result = validatePurposeTemplateRiskAnalysis(
      template,
      tenantKind.PA,
      true
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysisTemplate3_2_Pa,
    });
  });

  describe.each([tenantKind.PA, tenantKind.PRIVATE])(
    "online privacy policy suggestions (%s)",
    (kind) => {
      const urls = [
        "https://example.com/privacy",
        "http://example.com/privacy",
      ];

      it("should accept URL suggestions in a complete risk analysis template", () => {
        const template = createTemplateWithoutField(
          createValidTemplate(kind),
          "reasonPolicyNotProvided"
        );
        template.answers.policyProvided = {
          values: ["YES"],
          editable: false,
          suggestedValues: [],
        };
        template.answers.policyProvidedMedium = {
          values: ["ONLINE"],
          editable: false,
          suggestedValues: [],
        };
        template.answers.policyProvidedOnlineLink = {
          values: [],
          editable: false,
          suggestedValues: urls,
        };

        const result = validatePurposeTemplateRiskAnalysis(
          template,
          kind,
          true
        );

        expect(result.type).toBe("valid");
        if (result.type === "valid") {
          expect(result.value.singleAnswers).toContainEqual({
            key: "policyProvidedOnlineLink",
            value: undefined,
            editable: false,
            suggestedValues: urls,
          });
        }
      });

      it("should accept URL suggestions when validating a single answer", () => {
        const result = validateRiskAnalysisAnswer(
          "policyProvidedOnlineLink",
          { values: [], editable: false, suggestedValues: urls },
          kind
        );

        expect(result.type).toBe("valid");
      });

      it("should still reject URL suggestions in other free text fields", () => {
        const template = createTemplateWithModifiedField(
          createValidTemplate(kind),
          "institutionalPurpose",
          { suggestedValues: urls }
        );

        expect(
          validatePurposeTemplateRiskAnalysis(template, kind, true)
        ).toEqual({
          type: "invalid",
          issues: [
            unexpectedRiskAnalysisTemplateFieldHyperlinkError(
              "institutionalPurpose"
            ),
          ],
        });
      });

      it("should still enforce the privacy policy suggestion structure", () => {
        const result = validateRiskAnalysisAnswer(
          "policyProvidedOnlineLink",
          { values: [], editable: true, suggestedValues: urls },
          kind
        );

        expect(result).toEqual({
          type: "invalid",
          issues: [
            malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
              "policyProvidedOnlineLink"
            ),
          ],
        });
      });
    }
  );

  it("should succeed on correct form 2.1 on tenant kind PRIVATE", () => {
    const template = createValidTemplate(tenantKind.PRIVATE);
    const result = validatePurposeTemplateRiskAnalysis(
      template,
      tenantKind.PRIVATE,
      true
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysisTemplate2_1_Private,
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
      { editable: true, values: ["value"] }
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
