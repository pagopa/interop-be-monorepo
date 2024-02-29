import { describe, expect, it } from "vitest";

import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  missingExpectedFieldError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldValue,
  unexpectedTemplateVersionError,
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

const expectedValidatedRiskANalysis2_0_Private: RiskAnalysisValidatedForm = {
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
    usesPersonalData: [],
    usesThirdPartyPersonalData: [],
    usesConfidentialData: [],
  },
};

export const validSchemaOnlyRiskAnalysis2_0_Private: RiskAnalysisFormToValidate =
  {
    version: "2.0",
    answers: {
      purpose: ["INSTITUTIONAL"],
      usesPersonalData: [],
      usesThirdPartyPersonalData: [],
      usesConfidentialData: [],
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
    expect(result).toMatchObject(expectedValidatedRiskAnalysis3_0_Pa);
    expect(result).toMatchObject(resultSchemaOnly);
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

    expect(result).toMatchObject(expected);
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
    expect(result).toMatchObject(expectedValidatedRiskANalysis2_0_Private);
    expect(result).toMatchObject(resultSchemaOnly);
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

    expect(result).toMatchObject(expected);
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
    expect(result).toMatchObject(expectedValidatedRiskANalysis2_0_Private);
    expect(result).toMatchObject(resultSchemaOnly);
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

    expect(result).toMatchObject(expected);
  });

  it("should fail if version does not exists", () => {
    const invalidRiskAnalysis: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis3_0_Pa,
      version: "9999.0",
    };

    expect(() =>
      validateRiskAnalysis(invalidRiskAnalysis, false, "PA")
    ).toThrowError(unexpectedTemplateVersionError(invalidRiskAnalysis.version));

    const invalidRiskAnalysis2: RiskAnalysisFormToValidate = {
      ...validRiskAnalysis2_0_Private,
      version: "not a valid version",
    };

    expect(() =>
      validateRiskAnalysis(invalidRiskAnalysis2, false, "PRIVATE")
    ).toThrowError(
      unexpectedTemplateVersionError(invalidRiskAnalysis2.version)
    );
  });

  it("fail if a provided answer depends on a missing field", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        confirmedDoneDpia: ["YES"],
        doneDpia: [],
      },
    };

    expect(() => validateRiskAnalysis(riskAnalysis, false, "PA")).toThrowError(
      missingExpectedFieldError("doneDpia")
      /* If the field was not required, it would return the following error:
      dependencyNotFoundError("confirmedDoneDpia", "doneDpia")

      ^^ No way to test this error with the current templates, as all the fields are required */
    );
  });

  it("should succeed schema only even if a provided answer depends on a missing field", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        confirmedDoneDpia: ["YES"],
        doneDpia: [],
      },
    };

    const result = validateRiskAnalysis(riskAnalysis, true, "PA");
    const expected: RiskAnalysisValidatedForm = {
      ...expectedValidatedRiskAnalysis3_0_Pa,
      singleAnswers: [
        ...expectedValidatedRiskAnalysis3_0_Pa.singleAnswers.filter(
          (a) => a.key !== "doneDpia"
        ),
        { key: "confirmedDoneDpia", value: "YES" },
      ],
    };

    expect(result).toMatchObject(expected);
  });

  it("should fail if a provided answer depends on an existing field with an unexpected value", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        purpose: ["INSTITUTIONAL"],
        otherPurpose: ["otherPurpose"], // otherPurpose requires purpose to be OTHER
      },
    };

    expect(() => validateRiskAnalysis(riskAnalysis, false, "PA")).toThrowError(
      unexpectedDependencyValueError("otherPurpose", "purpose", "OTHER")
    );

    const riskAnalysis2: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        purpose: ["OTHER"],
        otherPurpose: ["otherPurpose"],
        institutionalPurpose: ["institutionalPurpose"], // institutionalPurpose requires purpose to be INSTITUTIONAL
      },
    };

    expect(() =>
      validateRiskAnalysis(riskAnalysis2, false, "PRIVATE")
    ).toThrowError(
      unexpectedDependencyValueError(
        "institutionalPurpose",
        "purpose",
        "INSTITUTIONAL"
      )
    );
  });

  it("should succeed schema only even if a provided answer depends on an existing field with an unexpected value", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: "2.0",
      answers: {
        purpose: ["INSTITUTIONAL"],
        institutionalPurpose: ["institutionalPurpose"],
        otherPurpose: ["otherPurpose"],
        legalBasisPublicInterest: ["RULE_OF_LAW"],
      },
    };

    const result = validateRiskAnalysis(riskAnalysis, true, "PRIVATE");
    const expected: RiskAnalysisValidatedForm = {
      version: riskAnalysis.version,
      singleAnswers: [
        { key: "purpose", value: "INSTITUTIONAL" },
        { key: "institutionalPurpose", value: "institutionalPurpose" },
        { key: "otherPurpose", value: "otherPurpose" },
        { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
      ],
      multiAnswers: [],
    };

    expect(result).toMatchObject(expected);
  });

  it("should fail on missing expected answers", () => {
    const invalidRiskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        doneDpia: [],
      },
    };

    expect(() =>
      validateRiskAnalysis(invalidRiskAnalysis, false, "PA")
    ).toThrowError(missingExpectedFieldError("doneDpia"));

    const invalidRiskAnalysis2: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        policyProvided: [],
      },
    };
    expect(() =>
      validateRiskAnalysis(invalidRiskAnalysis2, false, "PA")
    ).toThrowError(missingExpectedFieldError("policyProvided"));

    const invalidRiskAnalysis3: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        deliveryMethod: [],
      },
    };

    expect(() =>
      validateRiskAnalysis(invalidRiskAnalysis3, false, "PA")
    ).toThrowError(missingExpectedFieldError("deliveryMethod"));
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

    const result = validateRiskAnalysis(riskAnalysis, true, "PA");
    const expected: RiskAnalysisValidatedForm = {
      version: riskAnalysis.version,
      singleAnswers: [
        { key: "purpose", value: "INSTITUTIONAL" },
        { key: "institutionalPurpose", value: "institutionalPurpose" },
        { key: "otherPurpose", value: "otherPurpose" },
        { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
      ],
      multiAnswers: [],
    };

    expect(result).toMatchObject(expected);
  });

  it("should fail on unexpected field name both schema only and not", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        unexpectedField: ["unexpected value"],
      },
    };

    expect(() => validateRiskAnalysis(riskAnalysis, false, "PA")).toThrowError(
      unexpectedFieldError("unexpectedField")
    );

    expect(() => validateRiskAnalysis(riskAnalysis, true, "PA")).toThrowError(
      unexpectedFieldError("unexpectedField")
    );
  });

  it("should fail on unexpected field value both schema only and not", () => {
    const riskAnalysis: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis3_0_Pa.version,
      answers: {
        ...validRiskAnalysis3_0_Pa.answers,
        purpose: ["unexpected value"],
      },
    };

    expect(() => validateRiskAnalysis(riskAnalysis, false, "PA")).toThrowError(
      unexpectedFieldValue("purpose", new Set(["INSTITUTIONAL", "OTHER"]))
    );

    expect(() => validateRiskAnalysis(riskAnalysis, true, "PA")).toThrowError(
      unexpectedFieldValue("purpose", new Set(["INSTITUTIONAL", "OTHER"]))
    );

    const riskAnalysis2: RiskAnalysisFormToValidate = {
      version: validRiskAnalysis2_0_Private.version,
      answers: {
        ...validRiskAnalysis2_0_Private.answers,
        usesThirdPartyPersonalData: ["unexpected value"],
      },
    };

    expect(() =>
      validateRiskAnalysis(riskAnalysis2, false, "PRIVATE")
    ).toThrowError(
      unexpectedFieldValue("usesThirdPartyPersonalData", new Set(["YES", "NO"]))
    );

    expect(() =>
      validateRiskAnalysis(riskAnalysis2, true, "PRIVATE")
    ).toThrowError(
      unexpectedFieldValue("usesThirdPartyPersonalData", new Set(["YES", "NO"]))
    );
  });
});
