import {
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
} from "pagopa-interop-commons";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  validRiskAnalysis2_0_Private,
  validRiskAnalysis3_0_Pa,
} from "./riskAnalysisTestUtils.js";

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
        suggestedValues: [],
      },
      {
        key: "deliveryMethod",
        value: "ANONYMOUS",
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
        key: "dataDownload",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "confirmDataRetentionPeriod",
        value: "true",
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
        key: "usesThirdPartyData",
        value: "NO",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "declarationConfirmGDPR",
        value: "true",
        editable: false,
        suggestedValues: [],
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
        value: undefined,
        editable: false,
        suggestedValues: ["Because1", "Because2"],
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

export const getMockRiskAnalysisTemplateAnswerAnnotationDocument = (
  id: RiskAnalysisTemplateAnswerAnnotationDocumentId = generateId(),
  purposeTemplateId: PurposeTemplateId = generateId(),
  basePath: string = "purposeTemplateAnnotationsPath",
  name: string = `Document-${id}`
): RiskAnalysisTemplateAnswerAnnotationDocument => ({
  id,
  name,
  path: `${basePath}/${purposeTemplateId}/${id}/${name}`,
  prettyName: "prettyName",
  contentType: "application/pdf",
  createdAt: new Date(),
});

export const getMockRiskAnalysisTemplateAnswerAnnotation = (
  id: RiskAnalysisTemplateAnswerAnnotationId = generateId(),
  docNumber: number = 0
): RiskAnalysisTemplateAnswerAnnotation => ({
  id,
  text: "Annotation text in answer",
  docs: Array.from({ length: docNumber }, () =>
    getMockRiskAnalysisTemplateAnswerAnnotationDocument()
  ),
});

export const getMockRiskAnalysisTemplateAnswerAnnotationWithDocs = (
  id: RiskAnalysisTemplateAnswerAnnotationId = generateId(),
  docs: RiskAnalysisTemplateAnswerAnnotationDocument[]
): RiskAnalysisTemplateAnswerAnnotation => ({
  id,
  text: "Annotation text in answer",
  docs,
});
