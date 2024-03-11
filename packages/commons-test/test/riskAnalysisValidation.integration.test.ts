import { describe, expect, it } from "vitest";

import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  dependencyNotFoundError,
  missingExpectedFieldError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldValueError,
  unexpectedRulesVersionError,
  validateRiskAnalysis,
} from "pagopa-interop-commons";

export const validRiskAnalysis3_0_Pa: RiskAnalysisFormToValidate = {
  version: "3.0",
  answers: {
    purpose: ["INSTITUTIONAL"],
    institutionalPurpose: ["MyPurpose"],
    personalDataTypes: ["OTHER"],
    otherPersonalDataTypes: ["MyDataTypes"],
    legalBasis: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
    legalObligationReference: ["somethingLegal"],
    legalBasisPublicInterest: ["RULE_OF_LAW"],
    ruleOfLawText: ["TheLaw"],
    knowsDataQuantity: ["NO"],
    dataQuantity: [],
    deliveryMethod: ["ANONYMOUS"],
    policyProvided: ["NO"],
    confirmPricipleIntegrityAndDiscretion: ["true"],
    reasonPolicyNotProvided: ["Because"],
    doneDpia: ["NO"],
    dataDownload: ["YES"],
    confirmDataRetentionPeriod: ["true"],
    purposePursuit: ["MERE_CORRECTNESS"],
    checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
    usesThirdPartyData: ["NO"],
    declarationConfirmGDPR: ["true"],
  },
};

const expectedValidatedRiskAnalysis3_0_Pa: RiskAnalysisValidatedForm = {
  version: validRiskAnalysis3_0_Pa.version,
  singleAnswers: [
    { key: "purpose", value: "INSTITUTIONAL" },
    { key: "institutionalPurpose", value: "MyPurpose" },
    { key: "otherPersonalDataTypes", value: "MyDataTypes" },
    { key: "legalObligationReference", value: "somethingLegal" },
    { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
    { key: "ruleOfLawText", value: "TheLaw" },
    { key: "knowsDataQuantity", value: "NO" },
    { key: "deliveryMethod", value: "ANONYMOUS" },
    { key: "policyProvided", value: "NO" },
    { key: "confirmPricipleIntegrityAndDiscretion", value: "true" },
    { key: "reasonPolicyNotProvided", value: "Because" },
    { key: "doneDpia", value: "NO" },
    { key: "dataDownload", value: "YES" },
    { key: "confirmDataRetentionPeriod", value: "true" },
    { key: "purposePursuit", value: "MERE_CORRECTNESS" },
    {
      key: "checkedExistenceMereCorrectnessInteropCatalogue",
      value: "true",
    },
    { key: "usesThirdPartyData", value: "NO" },
    { key: "declarationConfirmGDPR", value: "true" },
  ],
  multiAnswers: [
    { key: "personalDataTypes", values: ["OTHER"] },
    { key: "legalBasis", values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"] },
  ],
};

export const validRiskAnalysis2_0_Private: RiskAnalysisFormToValidate = {
  version: "2.0",
  answers: {
    purpose: ["INSTITUTIONAL"],
    institutionalPurpose: ["MyPurpose"],
    usesPersonalData: ["YES"],
    personalDataTypes: ["OTHER"],
    otherPersonalDataTypes: ["MyDataTypes"],
    legalBasis: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
    legalObligationReference: ["YES"],
    legalBasisPublicInterest: ["RULE_OF_LAW"],
    ruleOfLawText: ["TheLaw"],
    knowsDataQuantity: ["NO"],
    dataQuantity: [],
    dataDownload: ["YES"],
    deliveryMethod: ["CLEARTEXT"],
    policyProvided: ["NO"],
    confirmPricipleIntegrityAndDiscretion: ["true"],
    reasonPolicyNotProvided: ["Because"],
    doneDpia: ["NO"],
    dataRetentionPeriod: ["10"],
    purposePursuit: ["MERE_CORRECTNESS"],
    checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
    declarationConfirmGDPR: ["true"],
  },
};

const expectedValidatedRiskAnalysis2_0_Private: RiskAnalysisValidatedForm = {
  version: validRiskAnalysis2_0_Private.version,
  singleAnswers: [
    { key: "purpose", value: "INSTITUTIONAL" },
    { key: "institutionalPurpose", value: "MyPurpose" },
    { key: "usesPersonalData", value: "YES" },
    { key: "otherPersonalDataTypes", value: "MyDataTypes" },
    { key: "legalObligationReference", value: "YES" },
    { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
    { key: "ruleOfLawText", value: "TheLaw" },
    { key: "knowsDataQuantity", value: "NO" },
    { key: "dataDownload", value: "YES" },
    { key: "deliveryMethod", value: "CLEARTEXT" },
    { key: "policyProvided", value: "NO" },
    { key: "confirmPricipleIntegrityAndDiscretion", value: "true" },
    { key: "reasonPolicyNotProvided", value: "Because" },
    { key: "doneDpia", value: "NO" },
    { key: "dataRetentionPeriod", value: "10" },
    { key: "purposePursuit", value: "MERE_CORRECTNESS" },
    {
      key: "checkedExistenceMereCorrectnessInteropCatalogue",
      value: "true",
    },
    { key: "declarationConfirmGDPR", value: "true" },
  ],
  multiAnswers: [
    { key: "personalDataTypes", values: ["OTHER"] },
    { key: "legalBasis", values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"] },
  ],
};

export const validSchemaOnlyRiskAnalysis3_0_Pa: RiskAnalysisFormToValidate = {
  version: "3.0",
  answers: {
    purpose: ["INSTITUTIONAL"],
    usesThirdPartyData: [],
  },
};

export const validSchemaOnlyRiskAnalysis2_0_Private: RiskAnalysisFormToValidate =
  {
    version: "2.0",
    answers: {
      purpose: ["INSTITUTIONAL"],
      usesPersonalData: [],
      usesThirdPartyPersonalData: [],
    },
  };

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
      value: expectedValidatedRiskAnalysis3_0_Pa,
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
      value: expectedValidatedRiskAnalysis2_0_Private,
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
      value: expectedValidatedRiskAnalysis2_0_Private,
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

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, true, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, true, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, true, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual(
      validateRiskAnalysis(riskAnalysis, true, "PA")
    );

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual({
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

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual(
      validateRiskAnalysis(riskAnalysis, true, "PA")
    );

    expect(validateRiskAnalysis(riskAnalysis, false, "PA")).toEqual({
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
});
