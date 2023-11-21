import {
  TenantProcessError,
  ErrorTypes,
  Problem,
  ProcessError,
  makeApiProblem,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ZodiosBodyByPath } from "@zodios/core";
import { api } from "./generated/api.js";

const servicePrefix = "tenant";

export type ApiError = Problem;
type Api = typeof api.api;
export type ApiSelfcareTenantSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/selfcare/tenants"
>;
export type ApiM2MTenantSeed = ZodiosBodyByPath<Api, "post", "/m2m/tenants">;
export type ApiInternalTenantSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/internal/tenants"
>;

export function makeApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with(
      P.instanceOf(ProcessError),
      P.instanceOf(TenantProcessError),
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
        "Generic error while processing tenant process error"
      )
    );
}
