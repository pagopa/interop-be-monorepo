import { ZodiosBodyByPath } from "@zodios/core";
import { P, match } from "ts-pattern";
import {
  CatalogProcessError,
  ErrorTypes,
  Problem,
  makeApiProblem,
} from "pagopa-interop-models";
import { api } from "./generated/api.js";

const servicePrefix = "attribute-registry";
type Api = typeof api.api;

export type ApiBulkAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/bulk/attributes"
>;

export type ApiCertifiedAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/certifiedAttributes"
>;

export type ApiVerifiedAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/verifiedAttributes"
>;

export type ApiDeclaredAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/declaredAttributes"
>;

export type ApiInternalCertifiedAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/internal/certifiedAttributes"
>;

export type ApiInternalServerError = Problem & {
  status: 500;
};

export type ApiError = Problem;

export type ListResult<T> = { results: T[]; totalCount: number };

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
