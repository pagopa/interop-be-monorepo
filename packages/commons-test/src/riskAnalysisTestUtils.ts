import { generateMock } from "@anatine/zod-mock";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
} from "pagopa-interop-commons";
import {
  EServiceTemplateRiskAnalysis,
  RiskAnalysis,
  RiskAnalysisForm,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";

export const expiredRiskAnalysis2_0_Pa: RiskAnalysisFormToValidate = {
  version: "2.0",
  answers: {
    purpose: ["INSTITUTIONAL"],
    institutionalPurpose: ["MyPurpose"],
    personalDataTypes: ["WITH_NON_IDENTIFYING_DATA"],
    legalBasis: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
    legalObligationReference: ["somethingLegal"],
    legalBasisPublicInterest: ["RULE_OF_LAW"],
    ruleOfLawText: ["TheLaw"],
    knowsDataQuantity: ["NO"],
    deliveryMethod: ["ANONYMOUS"],
    policyProvided: ["NO"],
    reasonPolicyNotProvided: ["Test"],
    confirmPricipleIntegrityAndDiscretion: ["true"],
    doneDpia: ["NO"],
    dataRetentionPeriod: ["true"],
    purposePursuit: ["MERE_CORRECTNESS"],
    checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
    usesThirdPartyData: ["NO"],
    declarationConfirmGDPR: ["true"],
  },
};

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

export const validRiskAnalysis3_1_Pa: RiskAnalysisFormToValidate = {
  version: "3.1",
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
    isRequestOnBehalfOfThirdParties: ["YES"],
    thirdPartiesRequestDataUsage: ["PA_ONLY"],
    declarationConfirmGDPR: ["true"],
  },
};

export const validRiskAnalysis3_1_Pa_no_personal_data: RiskAnalysisFormToValidate =
  {
    version: "3.1",
    answers: {
      purpose: ["INSTITUTIONAL"],
      institutionalPurpose: ["MyPurpose"],
      usesPersonalData: ["NO"],
      usesThirdPartyPersonalData: ["NO"],
      isRequestOnBehalfOfThirdParties: ["YES"],
      thirdPartiesRequestDataUsage: ["PA_ONLY"],
    },
  };

export const validatedRiskAnalysis2_0_Pa_Expired: RiskAnalysisValidatedForm = {
  version: "2.0",
  singleAnswers: [
    { key: "purpose", value: "INSTITUTIONAL" },
    { key: "institutionalPurpose", value: "MyPurpose" },
    { key: "legalObligationReference", value: "somethingLegal" },
    { key: "legalBasisPublicInterest", value: "RULE_OF_LAW" },
    { key: "ruleOfLawText", value: "TheLaw" },
    { key: "knowsDataQuantity", value: "NO" },
    { key: "deliveryMethod", value: "ANONYMOUS" },
    { key: "policyProvided", value: "NO" },
    { key: "reasonPolicyNotProvided", value: "Test" },
    { key: "confirmPricipleIntegrityAndDiscretion", value: "true" },
    { key: "doneDpia", value: "NO" },
    { key: "dataRetentionPeriod", value: "true" },
    { key: "purposePursuit", value: "MERE_CORRECTNESS" },
    {
      key: "checkedExistenceMereCorrectnessInteropCatalogue",
      value: "true",
    },
    { key: "usesThirdPartyData", value: "NO" },
    { key: "declarationConfirmGDPR", value: "true" },
  ],
  multiAnswers: [
    { key: "personalDataTypes", values: ["WITH_NON_IDENTIFYING_DATA"] },
    { key: "legalBasis", values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"] },
  ],
};

export const validatedRiskAnalysis3_0_Pa: RiskAnalysisValidatedForm = {
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

export const validatedRiskAnalysis3_1_Pa: RiskAnalysisValidatedForm = {
  version: validRiskAnalysis3_1_Pa.version,
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
    { key: "isRequestOnBehalfOfThirdParties", value: "YES" },
    { key: "thirdPartiesRequestDataUsage", value: "PA_ONLY" },
    { key: "declarationConfirmGDPR", value: "true" },
  ],
  multiAnswers: [
    { key: "personalDataTypes", values: ["OTHER"] },
    { key: "legalBasis", values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"] },
  ],
};

export const validatedRiskAnalysis3_1_Pa_no_personal_data: RiskAnalysisValidatedForm =
  {
    version: validRiskAnalysis3_1_Pa.version,
    singleAnswers: [
      { key: "purpose", value: "INSTITUTIONAL" },
      { key: "institutionalPurpose", value: "MyPurpose" },
      { key: "usesPersonalData", value: "NO" },
      { key: "usesThirdPartyPersonalData", value: "NO" },
      { key: "isRequestOnBehalfOfThirdParties", value: "YES" },
      { key: "thirdPartiesRequestDataUsage", value: "PA_ONLY" },
    ],
    multiAnswers: [],
  };

export const expiredRiskAnalysis1_0_Private: RiskAnalysisFormToValidate = {
  version: "1.0",
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
    dataDownload: ["YES"],
    deliveryMethod: ["CLEARTEXT"],
    policyProvided: ["NO"],
    confirmPricipleIntegrityAndDiscretion: ["true"],
    reasonPolicyNotProvided: ["Test"],
    doneDpia: ["NO"],
    dataRetentionPeriod: ["10"],
    purposePursuit: ["MERE_CORRECTNESS"],
    checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
    declarationConfirmGDPR: ["true"],
  },
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

export const validatedRiskAnalysis1_0_Private_Expired: RiskAnalysisValidatedForm =
  {
    version: expiredRiskAnalysis1_0_Private.version,
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
      { key: "reasonPolicyNotProvided", value: "Test" },
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

export const validatedRiskAnalysis2_0_Private: RiskAnalysisValidatedForm = {
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

export const getMockValidRiskAnalysis = (
  producerTenantKind: TenantKind
): RiskAnalysis =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormToNewRiskAnalysis(
        validatedRiskAnalysis3_1_Pa,
        generateMock(z.string()),
        producerTenantKind
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysis(
        validatedRiskAnalysis2_0_Private,
        generateMock(z.string()),
        producerTenantKind
      )
    )
    .exhaustive();

export const getMockExpiredRiskAnalysis = (
  producerTenantKind: TenantKind
): RiskAnalysis =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormToNewRiskAnalysis(
        validatedRiskAnalysis2_0_Pa_Expired,
        generateMock(z.string()),
        producerTenantKind
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysis(
        validatedRiskAnalysis1_0_Private_Expired,
        generateMock(z.string()),
        producerTenantKind
      )
    )
    .exhaustive();

export const getMockValidEServiceTemplateRiskAnalysis = (
  producerTenantKind: TenantKind
): EServiceTemplateRiskAnalysis => ({
  ...getMockValidRiskAnalysis(producerTenantKind),
  tenantKind: producerTenantKind,
});

export const getMockExpiredEServiceTemplateRiskAnalysis = (
  producerTenantKind: TenantKind
): EServiceTemplateRiskAnalysis => ({
  ...getMockExpiredRiskAnalysis(producerTenantKind),
  tenantKind: producerTenantKind,
});

export const getMockExpiredRiskAnalysisForm = (
  producerTenantKind: TenantKind
): RiskAnalysisForm =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysis2_0_Pa_Expired
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysis1_0_Private_Expired
      )
    )
    .exhaustive();

export const getMockValidRiskAnalysisForm = (
  producerTenantKind: TenantKind
): RiskAnalysisForm =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysis3_1_Pa
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysis2_0_Private
      )
    )
    .exhaustive();
