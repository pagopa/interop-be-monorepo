import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  attributeNotFound: "0001",
  invalidAttributeStructure: "0002",
  tenantDuplicate: "0003",
  tenantNotFound: "0004",
  eServiceNotFound: "0005",
  selfcareIdConflict: "0006",
};

export function attributeNotFound(identifier: string): ApiError {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: errorCodes.attributeNotFound,
    httpStatus: 404,
    title: "Attribute not found",
  });
}

export function invalidAttributeStructure(): ApiError {
  return new ApiError({
    detail: `Invalid attribute structure`,
    code: errorCodes.invalidAttributeStructure,
    httpStatus: 400,
    title: "Invalid attribute structure",
  });
}

export function tenantDuplicate(teanantName: string): ApiError {
  return new ApiError({
    detail: `Tenant ${teanantName} already exists`,
    code: errorCodes.tenantDuplicate,
    httpStatus: 409,
    title: "Duplicated tenant name",
  });
}

export function tenantNotFound(tenantId: string): ApiError {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: errorCodes.tenantNotFound,
    httpStatus: 404,
    title: "Tenant not found",
  });
}

export function eServiceNotFound(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: errorCodes.eServiceNotFound,
    httpStatus: 404,
    title: "EService not found",
  });
}

export function selfcareIdConflict({
  tenantId,
  existingSelfcareId,
  newSelfcareId,
}: {
  tenantId: string;
  existingSelfcareId: string;
  newSelfcareId: string;
}): ApiError {
  return new ApiError({
    detail: `Conflict on Tenant SelfCareId update for tenant ${tenantId}: old value ${existingSelfcareId} - new value ${newSelfcareId}`,
    code: errorCodes.selfcareIdConflict,
    httpStatus: 500,
    title: "Selfcare id conflict",
  });
}
