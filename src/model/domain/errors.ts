export const ErrorCode = {
  DuplicateEserviceName: "0010",
  ContentTypeParsingError: "0001",
  UnexpectedError: "9999", // TODO: arbitrary error code retrieve it
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class CatalogProcessError extends Error {
  public readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
  }
}
