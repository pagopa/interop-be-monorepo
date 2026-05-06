import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  riskAnalysisNotFound: "0001",
  duplicateRiskAnalysisName: "0002",
  invalidRiskAnalysisContext: "0003",
  validationFailed: "0004",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export const riskAnalysisNotFound = (riskAnalysisId: string): ApiError<ErrorCodes> =>
  new ApiError({
    code: "riskAnalysisNotFound",
    title: "Risk analysis not found",
    detail: `Risk analysis ${riskAnalysisId} not found`,
  });

export const duplicateRiskAnalysisName = (
  name: string,
  context: string,
  ownerId: string
): ApiError<ErrorCodes> =>
  new ApiError({
    code: "duplicateRiskAnalysisName",
    title: "Duplicate risk analysis name",
    detail: `Risk analysis name ${name} already exists for context ${context} and owner ${ownerId}`,
  });

export const invalidRiskAnalysisContext = (): ApiError<ErrorCodes> =>
  new ApiError({
    code: "invalidRiskAnalysisContext",
    title: "Invalid risk analysis context",
    detail: "Exactly one owner between eserviceId and templateId must be provided according to context",
  });

export const validationFailed = (): ApiError<ErrorCodes> =>
  new ApiError({
    code: "validationFailed",
    title: "Risk analysis validation failed",
    detail: "The provided risk analysis form is not valid for the selected tenant kind and ruleset",
  });
