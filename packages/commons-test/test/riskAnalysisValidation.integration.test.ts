import { describe, expect, it } from "vitest";

import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  dependencyNotFoundError,
  missingExpectedFieldError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldValue,
  unexpectedRulesVersionError,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  validRiskAnalysis2_0_Private,
  validRiskAnalysis3_0_Pa,
  validSchemaOnlyRiskAnalysis2_0_Private,
  validSchemaOnlyRiskAnalysis3_0_Pa,
  validatedRiskANalysis2_0_Private,
  validatedRiskAnalysis3_0_Pa,
} from "../src/riskAnalysisTestUtils.js";

describe("Risk Analysis Validation", () => {
  it("should succeed on correct form 3.0 on tenant kind PA", () => {
    const result = validateRiskAnalysis(validRiskAnalysis3_0_Pa, false, "PA");
    const resultSchemaOnly = validateRiskAnalysis(
      validRiskAnalysis3_0_Pa,
      true,
      "PA"
    );
    expect(result).toEqual({
      type: "valid",
      value: validatedRiskAnalysis3_0_Pa,
    });
    expect(result).toEqual(resultSchemaOnly);
  });

  it("should succeed on correct form 3.0 schema only on tenant kind PA", () => {
    const expected: RiskAnalysisValidatedForm = {
      version: validSchemaOnlyRiskAnalysis3_0_Pa.version,
      singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
      multiAnswers: [],
    };

    const result = validateRiskAnalysis(
      validSchemaOnlyRiskAnalysis3_0_Pa,
      true,
      "PA"
    );

    expect(result).toEqual({
      type: "valid",
      value: expected,
    });
  });

  it("should succeed on correct form 2.0 on tenant kind PRIVATE", () => {
    const result = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      false,
      "PRIVATE"
    );
    const resultSchemaOnly = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      true,
      "PRIVATE"
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskANalysis2_0_Private,
    });
    expect(result).toEqual(resultSchemaOnly);
  });

  it("should succeed on correct form 2.0 schema only on tenant kind PRIVATE", () => {
    const expected: RiskAnalysisValidatedForm = {
      version: validSchemaOnlyRiskAnalysis2_0_Private.version,
      singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
      multiAnswers: [],
    };

    const result = validateRiskAnalysis(
      validSchemaOnlyRiskAnalysis2_0_Private,
      true,
      "PRIVATE"
    );

    expect(result).toEqual({
      type: "valid",
      value: expected,
    });
  });

  it("should succeed on correct form 2.0 on tenant kind GSP", () => {
    const result = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      false,
      "GSP"
    );
    const resultSchemaOnly = validateRiskAnalysis(
      validRiskAnalysis2_0_Private,
      true,
      "GSP"
    );

    expect(result).toEqual({
      type: "valid",
      value: validatedRiskANalysis2_0_Private,
    });
    expect(result).toEqual(resultSchemaOnly);
  });

  it("should succeed on correct form 2.0 schema only on tenant kind GSP", () => {
    const expected: RiskAnalysisValidatedForm = {
      version: validSchemaOnlyRiskAnalysis2_0_Private.version,
      singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
      multiAnswers: [],
    };

    const result = validateRiskAnalysis(
      validSchemaOnlyRiskAnalysis2_0_Private,
      true,
      "GSP"
    );

    expect(result).toEqual({
      type: "valid",
      value: expected,
    });
  });

  it("should fail if version does not exists", () => {
    const invalidRiskAnalysis: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis3_0_Pa,
      version: "9999.0",
    };

    expect(validateRiskAnalysis(invalidRiskAnalysis, false, "PA")).toEqual({
      type: "invalid",
      issues: [unexpectedRulesVersionError(invalidRiskAnalysis.version)],
    });

    const invalidRiskAnalysis2: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis2_0_Private,
      version: "not a valid version",
    };

    expect(
      validateRiskAnalysis(invalidRiskAnalysis2, false, "PRIVATE")
    ).toEqual({
      type: "invalid",
      issues: [unexpectedRulesVersionError(invalidRiskAnalysis2.version)],
    });
  });

  it("fail if a provided answer depends on missing fields", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        doneDpia: [],
        confirmedDoneDpia: ["YES"], // confirmedDoneDpia requires doneDpia to be present
        policyProvided: [],
        reasonPolicyNotProvided: ["reason"], // reasonPolicyNotProvided requires policyProvided to be present
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual({
      type: "invalid",
      issues: [
        dependencyNotFoundError("reasonPolicyNotProvided", "policyProvided"),
        dependencyNotFoundError("confirmedDoneDpia", "doneDpia"),
        missingExpectedFieldError("policyProvided"),
        missingExpectedFieldError("doneDpia"),
      ],
    });

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        usesPersonalData: [], // usesPersonalData is required by many fields in the form
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")).toEqual(
      {
        type: "invalid",
        issues: [
          dependencyNotFoundError("personalDataTypes", "usesPersonalData"),
          dependencyNotFoundError("otherPersonalDataTypes", "usesPersonalData"),
          dependencyNotFoundError("legalBasis", "usesPersonalData"),
          dependencyNotFoundError(
            "legalObligationReference",
            "usesPersonalData"
          ),
          dependencyNotFoundError(
            "legalBasisPublicInterest",
            "usesPersonalData"
          ),
          dependencyNotFoundError("ruleOfLawText", "usesPersonalData"),
          dependencyNotFoundError("knowsDataQuantity", "usesPersonalData"),
          dependencyNotFoundError("dataDownload", "usesPersonalData"),
          dependencyNotFoundError("deliveryMethod", "usesPersonalData"),
          dependencyNotFoundError("policyProvided", "usesPersonalData"),
          dependencyNotFoundError(
            "confirmPricipleIntegrityAndDiscretion",
            "usesPersonalData"
          ),
          dependencyNotFoundError(
            "reasonPolicyNotProvided",
            "usesPersonalData"
          ),
          dependencyNotFoundError("doneDpia", "usesPersonalData"),
          dependencyNotFoundError("dataRetentionPeriod", "usesPersonalData"),
          dependencyNotFoundError("purposePursuit", "usesPersonalData"),
          dependencyNotFoundError(
            "checkedExistenceMereCorrectnessInteropCatalogue",
            "usesPersonalData"
          ),
          dependencyNotFoundError("declarationConfirmGDPR", "usesPersonalData"),
          missingExpectedFieldError("usesPersonalData"),
        ],
      }
    );
  });

  it("should succeed schema only even if a provided answer depends on a missing field", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        doneDpia: [],
        confirmedDoneDpia: ["YES"],
        policyProvided: [],
        reasonPolicyNotProvided: ["reason"],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, true, "PA")).toEqual({
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

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        usesPersonalData: [],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, true, "PRIVATE")).toEqual({
      type: "valid",
      value: {
        ...validatedRiskANalysis2_0_Private,
        singleAnswers: [
          ...validatedRiskANalysis2_0_Private.singleAnswers.filter(
            (a) => a.key !== "usesPersonalData"
          ),
        ],
      },
    });
  });

  it("should fail if a provided answer depends on existing fields with unexpected values", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        purpose: ["INSTITUTIONAL"],
        otherPurpose: ["otherPurpose"], // otherPurpose requires purpose to be OTHER
        legalBasis: ["LEGAL_OBLIGATION"],
        legalBasisPublicInterest: ["ADMINISTRATIVE_ACT"], // legalBasisPublicInterest requires legalBasis to be PUBLIC_INTEREST
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual({
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

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        usesPersonalData: ["NO"],
        usesThirdPartyPersonalData: ["NO"],
        purpose: ["OTHER"],
        otherPurpose: ["otherPurpose"],
        institutionalPurpose: ["institutionalPurpose"], // institutionalPurpose requires purpose to be INSTITUTIONAL
        declarationConfirmGDPR: ["true"], // declarationConfirmGDPR requires usesPersonalData to be YES
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")).toEqual(
      {
        type: "invalid",
        issues: [
          unexpectedDependencyValueError(
            "institutionalPurpose",
            "purpose",
            "INSTITUTIONAL"
          ),
          unexpectedDependencyValueError(
            "declarationConfirmGDPR",
            "usesPersonalData",
            "YES"
          ),
        ],
      }
    );
  });

  it("should succeed schema only even if a provided answer depends on an existing field with an unexpected value", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        purpose: ["INSTITUTIONAL"],
        otherPurpose: ["otherPurpose"], // otherPurpose requires purpose to be OTHER
        legalBasis: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
        legalBasisPublicInterest: ["ADMINISTRATIVE_ACT"], // legalBasisPublicInterest requires legalBasis to be PUBLIC_INTEREST
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, true, "PA")).toEqual({
      type: "valid",
      value: {
        version: riskAnalysisPa.version,
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

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        usesPersonalData: ["NO"],
        usesThirdPartyPersonalData: ["NO"],
        purpose: ["OTHER"],
        otherPurpose: ["otherPurpose"],
        institutionalPurpose: ["institutionalPurpose"],
        declarationConfirmGDPR: ["true"],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, true, "PRIVATE")).toEqual({
      type: "valid",
      value: {
        version: riskAnalysisPrivate.version,
        singleAnswers: [
          { key: "usesPersonalData", value: "NO" },
          { key: "usesThirdPartyPersonalData", value: "NO" },
          { key: "purpose", value: "OTHER" },
          { key: "otherPurpose", value: "otherPurpose" },
          { key: "institutionalPurpose", value: "institutionalPurpose" },
          { key: "declarationConfirmGDPR", value: "true" },
        ],
        multiAnswers: [],
      },
    });
  });

  it("should fail on missing expected answers", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        doneDpia: [],
        deliveryMethod: [],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual({
      type: "invalid",
      issues: [
        missingExpectedFieldError("deliveryMethod"),
        missingExpectedFieldError("doneDpia"),
      ],
    });

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        purpose: [],
        institutionalPurpose: [],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")).toEqual(
      {
        type: "invalid",
        issues: [missingExpectedFieldError("purpose")],
      }
    );
  });

  it("should succeeed schema only even on missing expected answers", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: "3.0",
      answers: {
        purpose: ["INSTITUTIONAL"],
        institutionalPurpose: ["institutionalPurpose"],
        otherPurpose: ["otherPurpose"],
        legalBasisPublicInterest: ["RULE_OF_LAW"],
        // missing many required fields
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, true, "PA")).toEqual({
      type: "valid",
      value: {
        version: riskAnalysisPa.version,
        singleAnswers: [
          { key: "purpose", value: "INSTITUTIONAL" },
          { key: "institutionalPurpose", value: "institutionalPurpose" },
          { key: "otherPurpose", value: "otherPurpose" },
          { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
        ],
        multiAnswers: [],
      },
    });

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: "2.0",
      answers: {
        usesPersonalData: ["YES"],
        // missing many required fields
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, true, "PRIVATE")).toEqual({
      type: "valid",
      value: {
        version: riskAnalysisPrivate.version,
        singleAnswers: [{ key: "usesPersonalData", value: "YES" }],
        multiAnswers: [],
      },
    });
  });

  it("should fail on unexpected field name both schema only and not", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        unexpectedFieldA: ["unexpected value A"],
        unexpectedFieldB: ["unexpected value B"],
        unexpectedFieldC: ["unexpected value C"],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual(
      validateRiskAnalysis(riskAnalysisPa, true, "PA")
    );

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual({
      type: "invalid",
      issues: [
        unexpectedFieldError("unexpectedFieldA"),
        unexpectedFieldError("unexpectedFieldB"),
        unexpectedFieldError("unexpectedFieldC"),
      ],
    });

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        unexpectedFieldA: ["unexpected value A"],
        unexpectedFieldB: ["unexpected value B"],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")).toEqual(
      validateRiskAnalysis(riskAnalysisPrivate, true, "PRIVATE")
    );

    expect(validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")).toEqual(
      {
        type: "invalid",
        issues: [
          unexpectedFieldError("unexpectedFieldA"),
          unexpectedFieldError("unexpectedFieldB"),
        ],
      }
    );
  });

  it("should fail on unexpected field value both schema only and not", () => {
    const riskAnalysisPa: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        institutionalPurpose: [],
        purpose: ["unexpected value"],
        legalBasis: ["unexpected value", "PUBLIC_INTEREST", "LEGAL_OBLIGATION"],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual(
      validateRiskAnalysis(riskAnalysisPa, true, "PA")
    );

    expect(validateRiskAnalysis(riskAnalysisPa, false, "PA")).toEqual({
      type: "invalid",
      issues: [
        unexpectedFieldValue("purpose", new Set(["INSTITUTIONAL", "OTHER"])),
        unexpectedFieldValue(
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

    const riskAnalysisPrivate: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        purpose: ["unexpected value"],
        institutionalPurpose: [],
        personalDataTypes: ["unexpected value", "OTHER"],
      },
    };

    expect(validateRiskAnalysis(riskAnalysisPrivate, true, "PRIVATE")).toEqual(
      validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")
    );

    expect(validateRiskAnalysis(riskAnalysisPrivate, false, "PRIVATE")).toEqual(
      {
        type: "invalid",
        issues: [
          unexpectedFieldValue("purpose", new Set(["INSTITUTIONAL", "OTHER"])),
          unexpectedFieldValue(
            "personalDataTypes",
            new Set([
              "WITH_NON_IDENTIFYING_DATA",
              "WITH_IDENTIFYING_DATA",
              "GDPR_ART_8",
              "GDPR_ART_9",
              "GDPR_ART_10",
              "OTHER",
            ])
          ),
        ],
      }
    );
  });
});
