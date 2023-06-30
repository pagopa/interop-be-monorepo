import { ZodiosBodyByPath, ZodiosErrorByPath } from "@zodios/core";
import { P, match } from "ts-pattern";
import { CatalogProcessError, ErrorCode } from "./domain/errors.js";
import { api } from "./generated/api.js";

type Api = typeof api.api;
export type ApiEServiceSeed = ZodiosBodyByPath<Api, "post", "/eservices">;

export type ApiErrorInvalidInput = ZodiosErrorByPath<
  Api,
  "post",
  "/eservices",
  400
>;

export type ApiErrorNameConflict = ZodiosErrorByPath<
  Api,
  "post",
  "/eservices",
  409
>;
export type ApiInternalServerError = Problem & {
  status: 500;
};

export type ApiError =
  | ApiErrorInvalidInput
  | ApiErrorNameConflict
  | ApiInternalServerError
  | Problem;

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
  detail: string
): Problem {
  return {
    type: "https://docs.pagopa.it/interoperabilita-1/", // TODO change this with properly schema definition URI
    title,
    status: httpStatus,
    detail,
    errors: [
      {
        code: errorCode,
        detail,
      },
    ],
  };
}

export function mapAuthorizationErrorToApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with({ code: ErrorCode.MissingBearer, message: P.string }, (error) =>
      makeApiProblem(
        ErrorCode.MissingBearer,
        400,
        error.message,
        "Bearer token has not been passed"
      )
    )
    .with({ code: ErrorCode.MissingClaim, message: P.string }, (error) =>
      makeApiProblem(ErrorCode.MissingClaim, 400, error.message, error.message)
    )
    .with({ code: ErrorCode.MissingHeader, message: P.string }, (error) =>
      makeApiProblem(ErrorCode.MissingHeader, 400, error.message, error.message)
    )
    .otherwise(() =>
      makeApiProblem(
        ErrorCode.MissingHeader,
        400,
        "Generic error while processing authorization header",
        "Unexpected error"
      )
    );
}

export function makeGenericErrorProblem(
  message: string = "Unexpected error"
): ApiError {
  return makeApiProblem(
    ErrorCode.GenericError,
    500,
    "Unexpected error",
    message
  );
}

export function mapCatalogServiceErrorToApiError(
  error: CatalogProcessError
): ApiError {
  return match(error)
    .with({ code: ErrorCode.DuplicateEserviceName }, (error) =>
      makeApiProblem(
        ErrorCode.DuplicateEserviceName,
        409,
        error.message,
        "Duplicated service name"
      )
    )
    .with({ code: ErrorCode.ContentTypeParsingError }, (error) =>
      makeApiProblem(
        ErrorCode.ContentTypeParsingError,
        400,
        error.message,
        "Malformed request"
      )
    )
    .with({ code: ErrorCode.EServiceNotFound }, (error) =>
      makeApiProblem(
        ErrorCode.EServiceNotFound,
        404,
        error.message,
        "EService not found"
      )
    )
    .with({ code: ErrorCode.EServiceCannotBeUpdatedOrDeleted }, (error) =>
      makeApiProblem(
        ErrorCode.EServiceCannotBeUpdatedOrDeleted,
        400,
        error.message,
        "EService cannot be updated"
      )
    )
    .with({ code: ErrorCode.OperationForbidden }, (error) =>
      makeApiProblem(
        ErrorCode.OperationForbidden,
        400,
        error.message,
        "Operation forbidden"
      )
    )
    .with({ code: ErrorCode.ContentTypeParsingError }, (error) =>
      makeApiProblem(
        ErrorCode.ContentTypeParsingError,
        500,
        error.message,
        "Internal server error"
      )
    )
    .with(
      { code: ErrorCode.MissingBearer },
      { code: ErrorCode.MissingClaim },
      { code: ErrorCode.MissingHeader },
      (error) => makeApiProblem(error.code, 500, error.message, error.message)
    )
    .with({ code: ErrorCode.GenericError }, (error) =>
      makeGenericErrorProblem(error.message)
    )
    .exhaustive();
}
