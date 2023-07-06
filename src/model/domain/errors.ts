export const ErrorCode = {
  DuplicateEserviceName: "0010",
  ContentTypeParsingError: "0001",
  EServiceNotFound: "0007",
  EServiceCannotBeUpdatedOrDeleted: "0009",
  EServiceDescriptorNotFound: "0002",
  EServiceDocumentNotFound: "0003", // TODO: reorganize error codes
  OperationForbidden: "9989",
  GenericError: "9991",
  MissingBearer: "9999",
  MissingClaim: "9990",
  MissingHeader: "9994",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class CatalogProcessError extends Error {
  public readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
  }
}

export function eServiceNotFound(eServiceId: string): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} not found`,
    ErrorCode.EServiceNotFound
  );
}

export const operationForbidden = new CatalogProcessError(
  `Insufficient privileges`,
  ErrorCode.OperationForbidden
);

export function eServiceCannotBeUpdated(
  eServiceId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} contains valid descriptors and cannot be updated`,
    ErrorCode.EServiceCannotBeUpdatedOrDeleted
  );
}

export function eServiceCannotBeDeleted(
  eServiceId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} contains descriptors and cannot be deleted`,
    ErrorCode.EServiceCannotBeUpdatedOrDeleted
  );
}
