/* eslint-disable @typescript-eslint/consistent-type-definitions */
export enum ErrorCode {
  DuplicateEserviceName = "0010",
  ContentTypeParsingError = "0001",
  UnexpectedError = "9999", // TODO: arbitrary error code retrieve it
}

export type DuplicatedEServiceNameError = CatalogProcessError & {
  readonly code: ErrorCode.DuplicateEserviceName;
};

export type ContentTypeParsingError = CatalogProcessError & {
  readonly code: ErrorCode.ContentTypeParsingError;
};

export class CatalogProcessError extends Error {
  public readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
  }
}
