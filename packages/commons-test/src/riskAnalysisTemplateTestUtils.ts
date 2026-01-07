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
  RiskAnalysisTemplateDocument,
  RiskAnalysisTemplateDocumentId,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSignedDocument,
  RiskAnalysisTemplateSingleAnswer,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  validRiskAnalysis2_0_Private,
  validRiskAnalysis3_0_Pa,
  validRiskAnalysis3_1_Pa,
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
        value: undefined,
        editable: false,
        suggestedValues: ["MyPurpose", "MyPurpose2"],
      },
      {
        key: "otherPersonalDataTypes",
        value: undefined,
        editable: false,
        suggestedValues: ["MyDataTypes", "MyDataTypes2"],
      },
      {
        key: "legalObligationReference",
        value: undefined,
        editable: false,
        suggestedValues: ["LegalObligation1", "LegalObligation2"],
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
        value: undefined,
        editable: false,
        suggestedValues: ["Because", "Because2"],
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

export const validatedRiskAnalysisTemplate3_1_Pa: RiskAnalysisTemplateValidatedForm =
  {
    version: validRiskAnalysis3_1_Pa.version,
    singleAnswers: [
      {
        key: "purpose",
        value: "INSTITUTIONAL",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "institutionalPurpose",
        value: undefined,
        editable: false,
        suggestedValues: ["MyPurpose", "MyPurpose2"],
      },
      {
        key: "usesPersonalData",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "otherPersonalDataTypes",
        value: undefined,
        editable: false,
        suggestedValues: ["MyDataTypes", "MyDataTypes2"],
      },
      {
        key: "legalObligationReference",
        value: undefined,
        editable: false,
        suggestedValues: ["LegalObligation1", "LegalObligation2"],
      },
      {
        key: "knowsDataQuantity",
        value: "NO",
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
        suggestedValues: ["Because", "Because2"],
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
        key: "dataRetentionPeriod",
        value: undefined,
        editable: false,
        suggestedValues: ["10", "20"],
      },
      {
        key: "isRequestOnBehalfOfThirdParties",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "thirdPartiesRequestDataUsage",
        value: "PA_ONLY",
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
      {
        key: "publicInterestTaskText",
        value: undefined,
        editable: false,
        suggestedValues: ["PublicInterestTaskText1", "PublicInterestTaskText2"],
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
        value: undefined,
        editable: false,
        suggestedValues: ["MyPurpose", "MyPurpose2"],
      },
      {
        key: "usesPersonalData",
        value: "YES",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "otherPersonalDataTypes",
        value: undefined,
        editable: false,
        suggestedValues: ["MyDataTypes", "MyDataTypes2"],
      },
      {
        key: "legalObligationReference",
        value: undefined,
        editable: false,
        suggestedValues: ["LegalObligation1", "LegalObligation2"],
      },
      {
        key: "legalBasisPublicInterest",
        value: "RULE_OF_LAW",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "ruleOfLawText",
        value: undefined,
        editable: false,
        suggestedValues: ["RuleOfLawText1", "RuleOfLawText2"],
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
        suggestedValues: ["Because", "Because2"],
      },
      {
        key: "doneDpia",
        value: "NO",
        editable: false,
        suggestedValues: [],
      },
      {
        key: "dataRetentionPeriod",
        value: undefined,
        editable: false,
        suggestedValues: ["10", "20"],
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
        validatedRiskAnalysisTemplate3_1_Pa
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
        validatedRiskAnalysisTemplate2_0_Private
      )
    )
    .exhaustive();

export const getMockCompleteRiskAnalysisFormTemplate = (
  producerTenantKind: TenantKind = tenantKind.PA
): RiskAnalysisFormTemplate => {
  const incompleteRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(producerTenantKind);

  const addAnnotationToAnswers = <
    T extends RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
  >(
    answers: T[]
  ): T[] =>
    answers.map(
      (a): T => ({
        ...a,
        annotation: getMockRiskAnalysisTemplateAnswerAnnotation(undefined, 1),
      })
    );

  return {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: addAnnotationToAnswers(
      incompleteRiskAnalysisFormTemplate.singleAnswers
    ),
    multiAnswers: addAnnotationToAnswers(
      incompleteRiskAnalysisFormTemplate.multiAnswers
    ),
    document: getMockRiskAnalysisTemplateDocument(),
    signedDocument: getMockRiskAnalysisTemplateSignedDocument(),
  };
};

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
  checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
});

export const getMockRiskAnalysisTemplateDocument = (
  id: RiskAnalysisTemplateDocumentId = generateId(),
  purposeTemplateId: PurposeTemplateId = generateId(),
  basePath: string = "purposeTemplatePath",
  name: string = `Document-${id}`
): RiskAnalysisTemplateDocument => ({
  id,
  name,
  path: `${basePath}/${purposeTemplateId}/${name}`,
  prettyName: "prettyName",
  contentType: "application/pdf",
  createdAt: new Date(),
});

export const getMockRiskAnalysisTemplateSignedDocument = (
  id: RiskAnalysisTemplateDocumentId = generateId(),
  purposeTemplateId: PurposeTemplateId = generateId(),
  basePath: string = "purposeTemplatePath",
  name: string = `Document-${id}-signed`
): RiskAnalysisTemplateSignedDocument => ({
  ...getMockRiskAnalysisTemplateDocument(id, purposeTemplateId, basePath, name),
  signedAt: new Date(),
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
