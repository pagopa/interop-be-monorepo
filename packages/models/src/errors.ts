/* eslint-disable max-classes-per-file */
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
    title: "Insufficient privileges",
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
  MissingSub: {
    code: "9995",
    httpStatus: 400,
    title: "Subject has not been passed",
  },
  MissingUserId: {
    code: "9996",
    httpStatus: 400,
    title: "Uid has not been passed",
  },
  Unauthorized: {
    code: "9991",
    httpStatus: 401,
    title: "Unauthorized",
  },
  InvalidDescriptorVersion: {
    code: "0004",
    httpStatus: 400,
    title: "Version is not a valid descriptor version",
  },
  NotValidDescriptor: {
    code: "0004",
    httpStatus: 400,
    title: "Not valid descriptor",
  },
  DraftDescriptorAlreadyExists: {
    code: "0008",
    httpStatus: 400,
    title: "EService already contains a draft descriptor",
  },
  AgreementNotFound: {
    code: "0009",
    httpStatus: 404,
    title: "Agreement not found",
  },
} as const;

export type ErrorType = (typeof ErrorTypes)[keyof typeof ErrorTypes];

export class ProcessError extends Error {
  public readonly type: ErrorType;

  constructor(message: string, type: ErrorType) {
    super(message);
    this.type = type;
  }
}

export class CatalogProcessError extends ProcessError {}
export class AgreementProcessError extends ProcessError {}

export function eServiceDuplicate(
  eServiceNameSeed: string
): CatalogProcessError {
  return new CatalogProcessError(
    `Error during EService creation with name ${eServiceNameSeed}`,
    ErrorTypes.DuplicateEserviceName
  );
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

export function eServiceDescriptorNotFound(
  eServiceId: string,
  descriptorId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
    ErrorTypes.EServiceDescriptorNotFound
  );
}

export function missingClaim(claimName: string): CatalogProcessError {
  return new CatalogProcessError(
    `Claim ${claimName} has not been passed`,
    ErrorTypes.MissingClaim
  );
}

export function missingHeader(headerName: string): CatalogProcessError {
  return new CatalogProcessError(
    `Header ${headerName} not existing in this request`,
    ErrorTypes.MissingHeader
  );
}

export function notValidDescriptor(
  descriptorId: string,
  descriptorStatus: string
): CatalogProcessError {
  return new CatalogProcessError(
    `Descriptor ${descriptorId} has a not valid status for this operation ${descriptorStatus}`,
    ErrorTypes.NotValidDescriptor
  );
}

export function draftDescriptorAlreadyExists(
  eServiceId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `EService ${eServiceId} already contains a draft descriptor`,
    ErrorTypes.DraftDescriptorAlreadyExists
  );
}

export function eServiceDocumentNotFound(
  eServiceId: string,
  descriptorId: string,
  documentId: string
): CatalogProcessError {
  return new CatalogProcessError(
    `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
    ErrorTypes.EServiceDocumentNotFound
  );
}

export function agreementNotFound(agreementId: string): AgreementProcessError {
  return new AgreementProcessError(
    `Agreement ${agreementId} not found`,
    ErrorTypes.AgreementNotFound
  );
}

export type ProblemError = {
  code: string;
  detail: string;
};

export type Problem = {
  type: string;
  status: number;
  title: string;
  correlationId?: string;
  detail: string;
  errors: ProblemError[];
};

export function makeApiProblem(
  errorCode: string,
  httpStatus: number,
  title: string,
  detail: string,
  correlationId?: string
): Problem {
  return {
    type: "https://docs.pagopa.it/interoperabilita-1/", // TODO change this with properly schema definition URI
    title,
    status: httpStatus,
    detail,
    correlationId,
    errors: [
      {
        code: errorCode,
        detail,
      },
    ],
  };
}
