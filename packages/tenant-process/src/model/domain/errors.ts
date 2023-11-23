import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  tenantNotFound: "0001",
  selfcareIdNotFound: "0002",
};

export function tenantNotFound(tenantId: string): ApiError {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: errorCodes.tenantNotFound,
    httpStatus: 404,
    title: "Tenant not found",
  });
}

export function selfcareIdNotFound(selfcareId: string): ApiError {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found in the catalog`,
    code: errorCodes.selfcareIdNotFound,
    httpStatus: 404,
    title: "Tenant with selfcareId not found",
  });
}
