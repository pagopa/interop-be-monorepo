/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
} = constants;

export const getEServiceTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activateEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const publishEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      "missingTemplateVersionInterface",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "notValidEServiceTemplateVersionState",
      "riskAnalysisValidationFailed",
      "missingPersonalDataFlag",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateNameErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateWithoutPublishedVersion",
      "eserviceTemplateDuplicate",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateIntendedTargetErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceTemplateWithoutPublishedVersion", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateDescriptionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceTemplateWithoutPublishedVersion", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateVersionQuotasErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "notValidEServiceTemplateVersionState",
      "inconsistentDailyCalls",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateNotInDraftState",
      "eserviceTemplateNotInReceiveMode",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("riskAnalysisNameDuplicate", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateNotInDraftState",
      "eserviceTemplateNotInReceiveMode",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "riskAnalysisNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateNotInDraftState",
      "eserviceTemplateNotInReceiveMode",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateVersionAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "notValidEServiceTemplateVersionState",
      "inconsistentAttributesSeedGroupsCount",
      "versionAttributeGroupSupersetMissingInAttributesSeed",
      "unchangedAttributes",
      "attributeDuplicatedInGroup",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createEServiceTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("originNotCompliant", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceTemplateDuplicate", () => HTTP_STATUS_CONFLICT)
    .with("inconsistentDailyCalls", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceTemplateNotInDraftState", () => HTTP_STATUS_BAD_REQUEST)
    .with("eserviceTemplateDuplicate", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateDraftTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      "attributeNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "notValidEServiceTemplateVersionState",
      "inconsistentDailyCalls",
      "attributeDuplicatedInGroup",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createEServiceTemplateVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "attributeNotFound",
      "attributeDuplicatedInGroup",
      "draftEServiceTemplateVersionAlreadyExists",
      "inconsistentDailyCalls",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("eserviceTemplateWithoutPublishedVersion", () => HTTP_STATUS_CONFLICT)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createEServiceTemplateDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("interfaceAlreadyExists", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "documentPrettyNameDuplicate",
      "checksumDuplicate",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getEServiceTemplateDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateVersionNotFound",
      "eserviceTemplateDocumentNotFound",
      "eserviceTemplateNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      "eserviceTemplateDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .with("documentPrettyNameDuplicate", () => HTTP_STATUS_CONFLICT)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceTemplateNotFound",
      "eserviceTemplateVersionNotFound",
      "eserviceTemplateDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("notValidEServiceTemplateVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getEServiceTemplatesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateEServiceTemplatePersonalDataFlagErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "eserviceTemplateWithoutPublishedVersion",
      "eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
