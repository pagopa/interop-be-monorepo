import {
  validRiskAnalysis3_0_Pa,
  validRiskAnalysis2_0_Private,
} from "pagopa-interop-commons-test";
import {
  RiskAnalysisFormTemplate,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
} from "../src/model/riskAnalysisFormTemplate.js";

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
