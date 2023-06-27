import { ZodiosBodyByPath, ZodiosErrorByPath } from "@zodios/core";
import { P, match } from "ts-pattern";
import { ErrorCode } from "../domain/errors.ts";
import { api } from "./api.ts";

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
  errors: Array<ProblemError>;
};

export function makeApiProblem(
  errorCode: string,
  httpStatus: number,
  title: string,
  detail: string
): Problem {
  return {
    type: "https://docs.pagopa.it/interoperabilita-1/", // TODO change this with properly schema definition URI
    title: title,
    status: httpStatus,
    detail: detail,
    errors: [
      {
        code: errorCode,
        detail: detail,
      },
    ],
  };
}

export function mapCatalogServiceErrorToApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with({ code: ErrorCode.DuplicateEserviceName, message: P.string }, error =>
      makeApiProblem(
        ErrorCode.DuplicateEserviceName,
        409,
        error.message,
        "Duplicated service name"
      )
    )
    .with(
      { code: ErrorCode.ContentTypeParsingError, message: P.string },
      error =>
        makeApiProblem(
          ErrorCode.ContentTypeParsingError,
          400,
          error.message,
          "Malformed request"
        )
    )
    .with(
      { code: ErrorCode.ContentTypeParsingError, message: P.string },
      error =>
        makeApiProblem(
          ErrorCode.ContentTypeParsingError,
          500,
          error.message,
          "Internal server error"
        )
    )
    .otherwise(() =>
      makeApiProblem(
        ErrorCode.ContentTypeParsingError,
        500,
        "Generic error while processing catalog process error",
        "Unexpected error"
      )
    );
}
