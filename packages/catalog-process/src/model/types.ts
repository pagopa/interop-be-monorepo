import { ZodiosBodyByPath, ZodiosErrorByPath } from "@zodios/core";
import { P, match } from "ts-pattern";
import { CatalogProcessError, ErrorTypes } from "pagopa-interop-models";
import { api } from "./generated/api.js";

type Api = typeof api.api;
export type ApiEServiceSeed = ZodiosBodyByPath<Api, "post", "/eservices">;

export type ApiEServiceDescriptorDocumentSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/eservices/:eServiceId/descriptors/:descriptorId/documents"
>;

export type ApiEServiceDescriptorDocumentUpdateSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update"
>;

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

const servicePrefix = "catalog";

export function makeApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with(P.instanceOf(CatalogProcessError), (error) =>
      makeApiProblem(
        error.type.code,
        error.type.httpStatus,
        error.type.title,
        error.message
      )
    )
    .otherwise(() =>
      makeApiProblem(
        `${servicePrefix}-${ErrorTypes.GenericError.code}`,
        ErrorTypes.GenericError.httpStatus,
        // eslint-disable-next-line sonarjs/no-duplicate-string
        ErrorTypes.GenericError.title,
        "Generic error while processing catalog process error"
      )
    );
}
