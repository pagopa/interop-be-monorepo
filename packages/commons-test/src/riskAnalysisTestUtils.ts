import { generateMock } from "@anatine/zod-mock";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
} from "pagopa-interop-commons";
import {
  EServiceTemplateRiskAnalysis,
  RiskAnalysis,
  RiskAnalysisForm,
  RiskAnalysisFormTemplate,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";

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

export const validatedRiskAnalysisTemplate3_0_Pa: RiskAnalysisTemplateValidatedForm =
  {
    version: validRiskAnalysis3_0_Pa.version,
    singleAnswers: [
      {
        key: "purpose",
        value: "INSTITUTIONAL",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "institutionalPurpose",
        value: "MyPurpose",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "otherPersonalDataTypes",
        value: "MyDataTypes",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "legalObligationReference",
        value: "somethingLegal",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "knowsDataQuantity",
        value: "NO",
        editable: false,
        suggestedValues: ["YES", "NO"],
      },
      {
        key: "deliveryMethod",
        value: "ANONYMOUS",
        editable: false,
        suggestedValues: ["ANONYMOUS", "PSEUDONYMOUS", "IDENTIFIED"],
      },
      {
        key: "policyProvided",
        value: "NO",
        editable: false,
        suggestedValues: ["YES", "NO"],
      },
      {
        key: "confirmPricipleIntegrityAndDiscretion",
        value: "true",
        editable: false,
        suggestedValues: ["true", "false"],
      },
      {
        key: "reasonPolicyNotProvided",
        value: "Because",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "doneDpia",
        value: "NO",
        editable: false,
        suggestedValues: ["YES", "NO"],
      },
      {
        key: "dataDownload",
        value: "YES",
        editable: false,
        suggestedValues: ["YES", "NO"],
      },
      {
        key: "confirmDataRetentionPeriod",
        value: "true",
        editable: false,
        suggestedValues: ["true", "false"],
      },
      {
        key: "purposePursuit",
        value: "MERE_CORRECTNESS",
        editable: false,
        suggestedValues: ["MERE_CORRECTNESS", "QUALITY_IMPROVEMENT"],
      },
      {
        key: "checkedExistenceMereCorrectnessInteropCatalogue",
        value: "true",
        editable: false,
        suggestedValues: ["true", "false"],
      },
      {
        key: "usesThirdPartyData",
        value: "NO",
        editable: false,
        suggestedValues: ["YES", "NO"],
      },
      {
        key: "declarationConfirmGDPR",
        value: "true",
        editable: false,
        suggestedValues: ["true", "false"],
      },
      {
        key: "publicInterestTaskText",
        value: undefined,
        editable: true,
        suggestedValues: [],
      },
      {
        key: "legalBasisPublicInterest",
        value: "PUBLIC_INTEREST_TASK",
        editable: false,
        suggestedValues: [],
      },
    ],
    multiAnswers: [
      { key: "personalDataTypes", values: ["OTHER"], editable: false },
      {
        key: "legalBasis",
        values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
        editable: false,
      },
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

export const validatedRiskAnalysisTemplate2_0_Private: RiskAnalysisTemplateValidatedForm =
  {
    version: validRiskAnalysis2_0_Private.version,
    singleAnswers: [
      {
        key: "purpose",
        value: "INSTITUTIONAL",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "institutionalPurpose",
        value: "MyPurpose",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "usesPersonalData",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "otherPersonalDataTypes",
        value: "MyDataTypes",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "legalObligationReference",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "legalBasisPublicInterest",
        value: "RULE_OF_LAW",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "ruleOfLawText",
        value: "TheLaw",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "knowsDataQuantity",
        value: "NO",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "dataDownload",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "deliveryMethod",
        value: "CLEARTEXT",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "policyProvided",
        value: "NO",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "confirmPricipleIntegrityAndDiscretion",
        value: "true",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "reasonPolicyNotProvided",
        value: "Because",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "doneDpia",
        value: "NO",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "dataRetentionPeriod",
        value: "10",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "purposePursuit",
        value: "MERE_CORRECTNESS",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "checkedExistenceMereCorrectnessInteropCatalogue",
        value: "true",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "declarationConfirmGDPR",
        value: "true",
        editable: false,
        suggestedValues: [],
      },
    ],
    multiAnswers: [
      { key: "personalDataTypes", values: ["OTHER"], editable: false },
      {
        key: "legalBasis",
        values: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
        editable: false,
      },
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
        validatedRiskAnalysis3_0_Pa,
        generateMock(z.string())
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysis(
        validatedRiskAnalysis2_0_Private,
        generateMock(z.string())
      )
    )
    .exhaustive();

export const getMockValidEServiceTemplateRiskAnalysis = (
  producerTenantKind: TenantKind
): EServiceTemplateRiskAnalysis => ({
  ...getMockValidRiskAnalysis(producerTenantKind),
  tenantKind: producerTenantKind,
});

export const getMockValidRiskAnalysisForm = (
  producerTenantKind: TenantKind
): RiskAnalysisForm =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysis3_0_Pa
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysis2_0_Private
      )
    )
    .exhaustive();

export const getMockValidRiskAnalysisFormTemplate = (
  producerTenantKind: TenantKind
): RiskAnalysisFormTemplate =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
        validatedRiskAnalysisTemplate3_0_Pa
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
        validatedRiskAnalysisTemplate2_0_Private
      )
    )
    .exhaustive();
