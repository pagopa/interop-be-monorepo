export const ErrorTypes = {
  DuplicateEserviceName: {
    code: "0010",
    httpStatus: 409,
    title: "Duplicated service name",
  },
  ContentTypeParsingError: {
    code: "0001",
    httpStatus: 400,
    title: "Malformed request",
  },
  EServiceNotFound: {
    code: "0007",
    httpStatus: 404,
    title: "EService not found",
  },
  EServiceCannotBeUpdatedOrDeleted: {
    code: "0009",
    httpStatus: 400,
    title: "EService cannot be updated or deleted",
  },
  EServiceDescriptorNotFound: {
    code: "0002",
    httpStatus: 404,
    title: "EService descriptor not found",
  },
  EServiceDocumentNotFound: {
    code: "0003",
    httpStatus: 404,
    title: "EService document not found",
  }, // TODO: reorganize error codes
  OperationForbidden: {
    code: "9989",
    httpStatus: 400,
    title: "Operation forbidden",
  },
  GenericError: { code: "9991", httpStatus: 500, title: "Unexpected error" },
  MissingBearer: {
    code: "9999",
    httpStatus: 400,
    title: "Bearer token has not been passed",
  },
  MissingClaim: {
    code: "9990",
    httpStatus: 400,
    title: "Claim has not been passed",
  },
  MissingHeader: {
    code: "9994",
    httpStatus: 400,
    title: "Header has not been passed",
  },
} as const;

export type ErrorType = (typeof ErrorTypes)[keyof typeof ErrorTypes];

export class CatalogProcessError extends Error {
  public readonly type: ErrorType;

  constructor(message: string, type: ErrorType) {
    super(message);
    this.type = type;
  }
}

export function eServiceNotFound(eServiceId: string): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} not found`,
    ErrorTypes.EServiceNotFound
  );
}

export const operationForbidden = new CatalogProcessError(
  `Insufficient privileges`,
  ErrorTypes.OperationForbidden
);

export function eServiceCannotBeUpdated(
  eServiceId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} contains valid descriptors and cannot be updated`,
    ErrorTypes.EServiceCannotBeUpdatedOrDeleted
  );
}

export function eServiceCannotBeDeleted(
  eServiceId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} contains descriptors and cannot be deleted`,
    ErrorTypes.EServiceCannotBeUpdatedOrDeleted
  );
}
