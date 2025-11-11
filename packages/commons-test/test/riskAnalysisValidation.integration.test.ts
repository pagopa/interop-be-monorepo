import { describe, expect, it, vi } from "vitest";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  dependencyNotFoundError,
  missingExpectedFieldError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldValueError,
  validateRiskAnalysis,
  rulesVersionNotFoundError,
  expiredRulesVersionError,
  incompatiblePersonalDataError,
} from "pagopa-interop-commons";
import { tenantKind } from "pagopa-interop-models";
import {
  expiredRiskAnalysis1_0_Private,
  expiredRiskAnalysis2_0_Pa,
  validRiskAnalysis2_0_Private,
  validRiskAnalysis3_0_Pa,
  validRiskAnalysis3_1_Pa,
  validRiskAnalysis3_1_Pa_no_personal_data,
  validSchemaOnlyRiskAnalysis2_0_Private,
  validSchemaOnlyRiskAnalysis3_0_Pa,
  validatedRiskAnalysis2_0_Pa_Expired,
  validatedRiskAnalysis2_0_Private,
  validatedRiskAnalysis3_0_Pa,
  validatedRiskAnalysis3_1_Pa,
  validatedRiskAnalysis3_1_Pa_no_personal_data,
} from "../src/riskAnalysisTestUtils.js";

describe("Risk Analysis Validation", () => {
  it("should succeed on correct form 3.0 (not expired) on tenant kind PA", () => {
    const result = validateRiskAnalysis(
      validRiskAnalysis3_0_Pa,
      false,
      "PA",
      new Date(),
      undefined
    );
    const resultSchemaOnly = validateRiskAnalysis(
      validRiskAnalysis3_0_Pa,
      true,
      "PA",
      new Date(),
      undefined
    );
    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysis3_0_Pa,
    });
    expect(result).toEqual(resultSchemaOnly);
  });

  it("should succeed on correct form 2.0 (when it wasn't expired) on tenant kind PA", () => {
    const mockDate = new Date("2023-01-01");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const result = validateRiskAnalysis(
      expiredRiskAnalysis2_0_Pa,
      false,
      "PA",
      new Date(),
      undefined
    );
    const resultSchemaOnly = validateRiskAnalysis(
      expiredRiskAnalysis2_0_Pa,
      true,
      "PA",
      new Date(),
      undefined
    );
    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysis2_0_Pa_Expired,
    });
    expect(result).toEqual(resultSchemaOnly);
    vi.useRealTimers();
  });

  it("should succeed on correct form 3.0 (not expired) schema only on tenant kind PA", () => {
    const expected: RiskAnalysisValidatedForm = {
      version: validSchemaOnlyRiskAnalysis3_0_Pa.version,
      singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
      multiAnswers: [],
    };

    const result = validateRiskAnalysis(
      validSchemaOnlyRiskAnalysis3_0_Pa,
      true,
      "PA",
      new Date(),
      undefined
    );

    expect(result).toEqual({
      type: "valid",
      value: expected,
    });
  });

  it("should succeed on correct form 2.0 (not expired) on tenant kind PRIVATE", () => {
    const result = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      false,
      "PRIVATE",
      new Date(),
      undefined
    );
    const resultSchemaOnly = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      true,
      "PRIVATE",
      new Date(),
      undefined
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysis2_0_Private,
    });
    expect(result).toEqual(resultSchemaOnly);
  });

  it("should succeed on correct form 2.0 (not expired) schema only on tenant kind PRIVATE", () => {
    const expected: RiskAnalysisValidatedForm = {
      version: validSchemaOnlyRiskAnalysis2_0_Private.version,
      singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
      multiAnswers: [],
    };

    const result = validateRiskAnalysis(
      validSchemaOnlyRiskAnalysis2_0_Private,
      true,
      "PRIVATE",
      new Date(),
      undefined
    );

    expect(result).toEqual({
      type: "valid",
      value: expected,
    });
  });

  it("should succeed on correct form 2.0 (not expired) on tenant kind GSP", () => {
    const result = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      false,
      "GSP",
      new Date(),
      undefined
    );
    const resultSchemaOnly = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      true,
      "GSP",
      new Date(),
      undefined
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysis2_0_Private,
    });
    expect(result).toEqual(resultSchemaOnly);
  });

  it("should succeed on correct form 2.0 (not expired) schema only on tenant kind GSP", () => {
    const expected: RiskAnalysisValidatedForm = {
      version: validSchemaOnlyRiskAnalysis2_0_Private.version,
      singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
      multiAnswers: [],
    };

    const result = validateRiskAnalysis(
      validSchemaOnlyRiskAnalysis2_0_Private,
      true,
      "GSP",
      new Date(),
      undefined
    );

    expect(result).toEqual({
      type: "valid",
      value: expected,
    });
  });

  it("should fail if version does not exists", () => {
    const invalidVersionForPA = "9999.0";
    const invalidRiskAnalysis: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis3_0_Pa,
      version: invalidVersionForPA,
    };

    expect(
      validateRiskAnalysis(
        invalidRiskAnalysis,
        false,
        "PA",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "invalid",
      issues: [rulesVersionNotFoundError("PA", invalidVersionForPA)],
    });

    const invalidVersionForPrivate = "not a valid version";
    const invalidRiskAnalysis2: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis2_0_Private,
      version: invalidVersionForPrivate,
    };

    expect(
      validateRiskAnalysis(
        invalidRiskAnalysis2,
        false,
        "PRIVATE",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "invalid",
      issues: [rulesVersionNotFoundError("PRIVATE", invalidVersionForPrivate)],
    });
  });

  it("should fail if version has expired", () => {
    const expiredVersionForPA = "2.0";
    const expiredRiskAnalysis: RiskAnalysisFormToValidate = {
      ...expiredRiskAnalysis2_0_Pa,
      version: expiredVersionForPA,
    };

    expect(
      validateRiskAnalysis(
        expiredRiskAnalysis,
        false,
        "PA",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "invalid",
      issues: [expiredRulesVersionError(expiredVersionForPA, tenantKind.PA)],
    });

    const expiredVersionForPrivate = "1.0";
    const expiredRiskAnalysis2: RiskAnalysisFormToValidate = {
      ...expiredRiskAnalysis1_0_Private,
      version: expiredVersionForPrivate,
    };

    expect(
      validateRiskAnalysis(
        expiredRiskAnalysis2,
        false,
        "PRIVATE",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "invalid",
      issues: [expiredRulesVersionError(expiredVersionForPrivate, "PRIVATE")],
    });
  });

  it("should fail if a provided answer depends on missing fields", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        doneDpia: [],
        confirmedDoneDpia: ["YES"], // confirmedDoneDpia requires doneDpia to be present
        policyProvided: [],
        reasonPolicyNotProvided: ["reason"], // reasonPolicyNotProvided requires policyProvided to be present
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual({
      type: "invalid",
      issues: [
        dependencyNotFoundError("reasonPolicyNotProvided", "policyProvided"),
        dependencyNotFoundError("confirmedDoneDpia", "doneDpia"),
        missingExpectedFieldError("policyProvided"),
        missingExpectedFieldError("doneDpia"),
      ],
    });
  });

  it("should succeed schema only even if a provided answer depends on a missing field", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        doneDpia: [],
        confirmedDoneDpia: ["YES"],
        policyProvided: [],
        reasonPolicyNotProvided: ["reason"],
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, true, "PA", new Date(), undefined)
    ).toEqual({
      type: "valid",
      value: {
        version: validRiskAnalysis3_0_Pa.version,
        singleAnswers: [
          { key: "confirmedDoneDpia", value: "YES" },
          { key: "reasonPolicyNotProvided", value: "reason" },
        ],
        multiAnswers: [],
      },
    });
  });

  it("should fail if a provided answer depends on existing fields with unexpected values", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        purpose: ["INSTITUTIONAL"],
        otherPurpose: ["otherPurpose"], // otherPurpose requires purpose to be OTHER
        legalBasis: ["LEGAL_OBLIGATION"],
        legalBasisPublicInterest: ["ADMINISTRATIVE_ACT"], // legalBasisPublicInterest requires legalBasis to be PUBLIC_INTEREST
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual({
      type: "invalid",
      issues: [
        unexpectedDependencyValueError(
          "legalBasisPublicInterest",
          "legalBasis",
          "PUBLIC_INTEREST"
        ),
        unexpectedDependencyValueError(
          "ruleOfLawText",
          "legalBasisPublicInterest",
          "RULE_OF_LAW"
        ),
        unexpectedDependencyValueError(
          "ruleOfLawText",
          "legalBasis",
          "PUBLIC_INTEREST"
        ),
        unexpectedDependencyValueError("otherPurpose", "purpose", "OTHER"),
      ],
    });
  });

  it("should succeed schema only even if a provided answer depends on an existing field with an unexpected value", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        purpose: ["INSTITUTIONAL"],
        otherPurpose: ["otherPurpose"], // otherPurpose requires purpose to be OTHER
        legalBasis: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
        legalBasisPublicInterest: ["ADMINISTRATIVE_ACT"], // legalBasisPublicInterest requires legalBasis to be PUBLIC_INTEREST
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, true, "PA", new Date(), undefined)
    ).toEqual({
      type: "valid",
      value: {
        version: riskAnalysis.version,
        singleAnswers: [
          { key: "purpose", value: "INSTITUTIONAL" },
          { key: "otherPurpose", value: "otherPurpose" },
          { key: "legalBasisPublicInterest", value: "ADMINISTRATIVE_ACT" },
        ],
        multiAnswers: [
          {
            key: "legalBasis",
            values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
          },
        ],
      },
    });
  });

  it("should fail on missing expected answers", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        doneDpia: [],
        deliveryMethod: [],
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual({
      type: "invalid",
      issues: [
        missingExpectedFieldError("deliveryMethod"),
        missingExpectedFieldError("doneDpia"),
      ],
    });
  });

  it("should succeeed schema only even on missing expected answers", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: "3.0",
      answers: {
        purpose: ["INSTITUTIONAL"],
        institutionalPurpose: ["institutionalPurpose"],
        otherPurpose: ["otherPurpose"],
        legalBasisPublicInterest: ["RULE_OF_LAW"],
        // missing many required fields
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, true, "PA", new Date(), undefined)
    ).toEqual({
      type: "valid",
      value: {
        version: riskAnalysis.version,
        singleAnswers: [
          { key: "purpose", value: "INSTITUTIONAL" },
          { key: "institutionalPurpose", value: "institutionalPurpose" },
          { key: "otherPurpose", value: "otherPurpose" },
          { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
        ],
        multiAnswers: [],
      },
    });
  });

  it("should fail on unexpected field name both schema only and not", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        unexpectedFieldA: ["unexpected value A"],
        unexpectedFieldB: ["unexpected value B"],
        unexpectedFieldC: ["unexpected value C"],
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual(
      validateRiskAnalysis(riskAnalysis, true, "PA", new Date(), undefined)
    );

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual({
      type: "invalid",
      issues: [
        unexpectedFieldError("unexpectedFieldA"),
        unexpectedFieldError("unexpectedFieldB"),
        unexpectedFieldError("unexpectedFieldC"),
      ],
    });
  });

  it("should fail on unexpected field value both schema only and not", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        institutionalPurpose: [],
        purpose: ["unexpected value"],
        legalBasis: ["unexpected value", "PUBLIC_INTEREST", "LEGAL_OBLIGATION"],
      },
    };

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual(
      validateRiskAnalysis(riskAnalysis, true, "PA", new Date(), undefined)
    );

    expect(
      validateRiskAnalysis(riskAnalysis, false, "PA", new Date(), undefined)
    ).toEqual({
      type: "invalid",
      issues: [
        unexpectedFieldValueError(
          "purpose",
          new Set(["INSTITUTIONAL", "OTHER"])
        ),
        unexpectedFieldValueError(
          "legalBasis",
          new Set([
            "CONSENT",
            "CONTRACT",
            "LEGAL_OBLIGATION",
            "SAFEGUARD",
            "PUBLIC_INTEREST",
          ])
        ),
      ],
    });
  });

  it("should fail if the risk analysis is PRIVATE 2.0 and the eservice has different personalData", () => {
    const riskAnalysisForm: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis2_0_Private,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        usesPersonalData: ["YES"],
      },
    };
    expect(
      validateRiskAnalysis(riskAnalysisForm, false, "GSP", new Date(), false)
    ).toEqual({
      type: "invalid",
      issues: [incompatiblePersonalDataError()],
    });
  });

  it("should succeed if the risk analysis is PRIVATE 2.0 and the eservice doesn't have the personalData flag", () => {
    expect(
      validateRiskAnalysis(
        validRiskAnalysis2_0_Private,
        false,
        "GSP",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "valid",
      value: validatedRiskAnalysis2_0_Private,
    });
  });

  it.each([true, false])(
    "should succeed if the risk analysis is PA 3.0 and the eservice has any personalData flag",
    (personalDataInEService) => {
      expect(
        validateRiskAnalysis(
          validRiskAnalysis3_0_Pa,
          false,
          "PA",
          new Date(),
          personalDataInEService
        )
      ).toEqual({
        type: "valid",
        value: validatedRiskAnalysis3_0_Pa,
      });
    }
  );

  it.each([
    new Date("2024-12-31"),
    new Date("2025-12-31"),
    new Date("2026-02-15T23:59"),
  ])(
    "should succeed if the risk analysis is PA 3.0 and the current date is within the grace period",
    (mockDate) => {
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      expect(
        validateRiskAnalysis(
          validRiskAnalysis3_0_Pa,
          false,
          "PA",
          new Date(),
          undefined
        )
      ).toEqual({
        type: "valid",
        value: validatedRiskAnalysis3_0_Pa,
      });

      vi.useRealTimers();
    }
  );

  it("should fail if version 3.0 PA has expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16"));

    expect(
      validateRiskAnalysis(
        validRiskAnalysis3_0_Pa,
        false,
        "PA",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "invalid",
      issues: [
        expiredRulesVersionError(
          validRiskAnalysis3_0_Pa.version,
          tenantKind.PA
        ),
      ],
    });

    const expiredVersionForPrivate = "1.0";
    const expiredRiskAnalysis2: RiskAnalysisFormToValidate = {
      ...expiredRiskAnalysis1_0_Private,
      version: expiredVersionForPrivate,
    };

    expect(
      validateRiskAnalysis(
        expiredRiskAnalysis2,
        false,
        "PRIVATE",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "invalid",
      issues: [expiredRulesVersionError(expiredVersionForPrivate, "PRIVATE")],
    });

    vi.useRealTimers();
  });

  it("should fail if the risk analysis is PA 3.1 and the eservice has different personalData", () => {
    const riskAnalysisForm: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis3_1_Pa,
      answers: {
        ...validRiskAnalysis3_1_Pa.answers,
        usesPersonalData: ["YES"],
      },
    };
    expect(
      validateRiskAnalysis(riskAnalysisForm, false, "PA", new Date(), false)
    ).toEqual({
      type: "invalid",
      issues: [incompatiblePersonalDataError()],
    });
  });

  it("should succeed if the risk analysis is PA 3.1 and the eservice doesn't have the personalData flag", () => {
    expect(
      validateRiskAnalysis(
        validRiskAnalysis3_1_Pa,
        false,
        "PA",
        new Date(),
        undefined
      )
    ).toEqual({
      type: "valid",
      value: validatedRiskAnalysis3_1_Pa,
    });
  });

  it.each([
    { personalDataInEService: true, usesPersonalData: "YES" },
    { personalDataInEService: false, usesPersonalData: "NO" },
  ])(
    "should succeed if the risk analysis is PA 3.1 and the eservice has consistent personalData flag",
    ({ personalDataInEService, usesPersonalData }) => {
      const riskAnalysisForm: RiskAnalysisFormToValidate =
        usesPersonalData === "YES"
          ? validRiskAnalysis3_1_Pa
          : validRiskAnalysis3_1_Pa_no_personal_data;
      expect(
        validateRiskAnalysis(
          riskAnalysisForm,
          false,
          "PA",
          new Date(),
          personalDataInEService
        )
      ).toEqual({
        type: "valid",
        value:
          usesPersonalData === "YES"
            ? validatedRiskAnalysis3_1_Pa
            : validatedRiskAnalysis3_1_Pa_no_personal_data,
      });
    }
  );
});
