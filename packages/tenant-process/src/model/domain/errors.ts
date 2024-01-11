import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  tenantNotFound: "0001",
  tenantBySelfcateIdNotFound: "0002",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function tenantNotFound(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantBySelfcateIdNotFound(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found in the catalog`,
    code: "tenantBySelfcateIdNotFound",
    title: "Tenant with selfcareId not found",
  });
}
