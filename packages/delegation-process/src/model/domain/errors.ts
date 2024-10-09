import {
  ApiError,
  EServiceId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  delegationNotFound: "0001",
  eserviceNotFound: "0002",
  delegationAlreadyExists: "0003",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function delegationNotFound(delegationId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function delegationAlreadyExists(
  delgatorId: string,
  delegeteId: string,
  eserviceId: string,
  delegationKind: string,
  delegationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation type ${delegationKind} already exists with id ${delegationId} for delegator ${delgatorId} and delegate ${delegeteId} for EService ${eserviceId}`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
  });
}
