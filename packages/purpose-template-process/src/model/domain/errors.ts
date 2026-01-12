import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  EServiceId,
  makeApiProblemBuilder,
  PurposeTemplateId,
  PurposeTemplateState,
  RiskAnalysisFormTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  TenantId,
  TargetTenantKind,
} from "pagopa-interop-models";
import { PurposeTemplateValidationIssue } from "../../errors/purposeTemplateValidationErrors.js";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateTitleConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  ruleSetNotFoundError: "0005",
  tenantNotAllowed: "0006",
  purposeTemplateNotInExpectedStates: "0007",
  purposeTemplateStateConflict: "0008",
  purposeTemplateRiskAnalysisFormNotFound: "0009",
  riskAnalysisTemplateAnswerNotFound: "0010",
  riskAnalysisTemplateAnswerAnnotationNotFound: "0011",
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound: "0012",
  associationEServicesForPurposeTemplateFailed: "0013",
  associationBetweenEServiceAndPurposeTemplateAlreadyExists: "0014",
  tooManyEServicesForPurposeTemplate: "0015",
  disassociationEServicesFromPurposeTemplateFailed: "0016",
  associationBetweenEServiceAndPurposeTemplateDoesNotExist: "0017",
  conflictDocumentPrettyNameDuplicate: "0018",
  annotationDocumentLimitExceeded: "0019",
  conflictDuplicatedDocument: "0020",
  hyperlinkDetectionError: "0021",
  purposeTemplateNotInValidState: "0022",
  invalidAssociatedEServiceForPublicationError: "0023",
  purposeTemplateRiskAnalysisTemplateDocumentNotFound: "0024",
  purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound: "0025",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function missingFreeOfChargeReason(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Missing free of charge reason",
    code: "missingFreeOfChargeReason",
    title: "Missing free of charge reason",
  });
}

export function purposeTemplateTitleConflict(
  purposeTemplateIds: PurposeTemplateId[],
  title: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template title conflict for title ${title} and IDs ${purposeTemplateIds.join(
      ", "
    )}`,
    code: "purposeTemplateTitleConflict",
    title: "Purpose Template title conflict",
  });
}

export function purposeTemplateNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Purpose Template found for ID ${purposeTemplateId}`,
    code: "purposeTemplateNotFound",
    title: "Purpose Template Not Found",
  });
}

export function invalidAssociatedEServiceForPublication(
  reasons: PurposeTemplateValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Linked e-service descriptors are not valid for publishing. Reasons: ${reasons}`,
    code: "invalidAssociatedEServiceForPublicationError",
    title: "Linked e-service descriptors are not valid for publishing",
  });
}

export function riskAnalysisTemplateValidationFailed(
  reasons: RiskAnalysisTemplateValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis template validation failed. Reasons: ${reasons}`,
    code: "riskAnalysisTemplateValidationFailed",
    title: "Risk analysis template validation failed",
  });
}

export function ruleSetNotFoundError(
  targetTenantKind: TargetTenantKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No risk analysis rule set found for target tenant kind ${targetTenantKind}`,
    code: "ruleSetNotFoundError",
    title: "No risk analysis rule set found for target tenant kind",
  });
}

export function tenantNotAllowed(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not allowed to perform the operation because it's not the creator`,
    code: "tenantNotAllowed",
    title: "Tenant not allowed",
  });
}

export function purposeTemplateNotInExpectedStates(
  purposeTemplateId: PurposeTemplateId,
  currentState: PurposeTemplateState,
  expectedStates: PurposeTemplateState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template ${purposeTemplateId} not in expected states (current state: ${currentState}, expected states: ${expectedStates.toString()})`,
    code: "purposeTemplateNotInExpectedStates",
    title: "Purpose Template not in expected states",
  });
}

export function purposeTemplateStateConflict(
  purposeTemplateId: PurposeTemplateId,
  state: PurposeTemplateState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template ${purposeTemplateId} is already in state ${state}`,
    code: "purposeTemplateStateConflict",
    title: "Purpose Template state conflict",
  });
}

export function purposeTemplateRiskAnalysisFormNotFound(
  purposeTemplateId: PurposeTemplateId,
  riskAnalysisTemplateId?: RiskAnalysisFormTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Form found for Purpose Template ${purposeTemplateId}${
      riskAnalysisTemplateId
        ? ` and Risk Analysis Template Form ${riskAnalysisTemplateId}`
        : ""
    }`,
    code: "purposeTemplateRiskAnalysisFormNotFound",
    title: "Purpose Template Risk Analysis Form Not Found",
  });
}

export function riskAnalysisTemplateAnswerNotFound({
  purposeTemplateId,
  answerId,
}: {
  purposeTemplateId?: PurposeTemplateId;
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
}): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Answer found for ${
      purposeTemplateId ? `Purpose Template ${purposeTemplateId}` : ""
    } and Answer ${answerId}`,
    code: "riskAnalysisTemplateAnswerNotFound",
    title: "Risk Analysis Template Answer Not Found",
  });
}

export function riskAnalysisTemplateAnswerAnnotationNotFound(
  purposeTemplateId: PurposeTemplateId,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Answer Annotation found for Purpose Template ${purposeTemplateId} and Answer ${answerId}`,
    code: "riskAnalysisTemplateAnswerAnnotationNotFound",
    title: "Risk Analysis Template Answer Annotation Not Found",
  });
}

export function riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
  purposeTemplateId: PurposeTemplateId,
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  answerId?: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis template answer annotation document ${documentId} not found for purpose template ${purposeTemplateId}${
      answerId ? ` and answer ${answerId}` : ""
    }`,
    code: "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
    title: "Risk Analysis Template Answer Annotation Document Not Found",
  });
}

export function associationEServicesForPurposeTemplateFailed(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Association of e-services to purpose template failed. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "associationEServicesForPurposeTemplateFailed",
    title: "Association of e-services to purpose template failed",
  });
}

export function associationBetweenEServiceAndPurposeTemplateAlreadyExists(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Association between e-services and purpose template failed. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "associationBetweenEServiceAndPurposeTemplateAlreadyExists",
    title: "Association between e-service and purpose template already exists",
  });
}

export function tooManyEServicesForPurposeTemplate(
  actualCount: number,
  maxCount: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Too many e-services provided. Maximum allowed: ${maxCount}, provided: ${actualCount}`,
    code: "tooManyEServicesForPurposeTemplate",
    title: "Too Many E-Services for Purpose Template",
  });
}

export function disassociationEServicesFromPurposeTemplateFailed(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Disassociation of e-services from purpose template failed. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "disassociationEServicesFromPurposeTemplateFailed",
    title: "Disassociation of e-services from purpose template failed",
  });
}

export function associationBetweenEServiceAndPurposeTemplateDoesNotExist(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Association between e-services and purpose template does not exist. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "associationBetweenEServiceAndPurposeTemplateDoesNotExist",
    title: "Association between e-services and purpose template does not exist",
  });
}

export function conflictDocumentPrettyNameDuplicate(
  answerId: string,
  prettyName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Conflict: annotation document with pretty name '${prettyName}' is duplicated for answer with id '${answerId}'`,
    code: "conflictDocumentPrettyNameDuplicate",
    title: "Annotation document with pretty name already exists",
  });
}

export function annotationDocumentLimitExceeded(
  answerId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Annotation document limit exceeded for answer with id '${answerId}'`,
    code: "annotationDocumentLimitExceeded",
    title: "Annotation document limit exceeded",
  });
}

export function conflictDuplicatedDocument(
  answerId: string,
  checksum: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Conflict: annotation document with checksum '${checksum}' is duplicated for answer with id '${answerId}'`,
    code: "conflictDuplicatedDocument",
    title: "Conflict: annotation document with checksum already exists",
  });
}
export function purposeTemplateNotInValidState(
  state: PurposeTemplateState,
  validStates: PurposeTemplateState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose template state is: ${state} but valid states are: ${validStates}`,
    code: "purposeTemplateNotInValidState",
    title: "Purpose template not in valid state",
  });
}

export function hyperlinkDetectionError(text: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Hyperlink detection error for text ${text}`,
    code: "hyperlinkDetectionError",
    title: "Hyperlink detection error",
  });
}

export function purposeTemplateRiskAnalysisTemplateDocumentNotFound(
  purposeTemplateRiskAnalysisForm: RiskAnalysisFormTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No document found for Risk Analysis Template Form ${purposeTemplateRiskAnalysisForm}`,
    code: "purposeTemplateRiskAnalysisTemplateDocumentNotFound",
    title: "Risk Analysis Template Document Not Found",
  });
}
export function purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound(
  purposeTemplateRiskAnalysisForm: RiskAnalysisFormTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No signed document found for Risk Analysis Template Form ${purposeTemplateRiskAnalysisForm}`,
    code: "purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound",
    title: "Risk Analysis Template Signed Document Not Found",
  });
}
