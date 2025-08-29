import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
  TenantId,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeTemplateNotFound: "0001",
  tenantNotAllowed: "0002",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function purposeTemplateNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Purpose Template found for ID ${purposeTemplateId}`,
    code: "purposeTemplateNotFound",
    title: "Purpose Template Not Found",
  });
}

export function tenantNotAllowed(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not allowed to perform the operation because it's not the creator`,
    code: "tenantNotAllowed",
    title: "Tenant not allowed",
  });
}
