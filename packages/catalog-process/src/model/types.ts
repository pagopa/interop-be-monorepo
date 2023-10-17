import { ZodiosBodyByPath, ZodiosErrorByPath } from "@zodios/core";
import { P, match } from "ts-pattern";
import {
  CatalogProcessError,
  ErrorTypes,
  Problem,
  ProcessError,
  makeApiProblem,
} from "pagopa-interop-models";
import { api } from "./generated/api.js";

const servicePrefix = "catalog";
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

export function makeApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with(
      P.instanceOf(ProcessError),
      P.instanceOf(CatalogProcessError),
      (error) =>
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
