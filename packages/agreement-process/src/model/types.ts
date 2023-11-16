import {
  AgreementProcessError,
  ErrorTypes,
  Problem,
  ProcessError,
  makeApiProblem,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ZodiosBodyByPath } from "@zodios/core";
import { z } from "zod";
import { api, schemas } from "./generated/api.js";

const servicePrefix = "agreement";

type Api = typeof api.api;
export type ApiAgreement = z.infer<typeof schemas.Agreement>;

export type ApiAgreementState = z.infer<typeof schemas.AgreementState>;

export type ApiAgreementDocument = z.infer<typeof schemas.Document>;

export type ApiAgreementPayload = ZodiosBodyByPath<Api, "post", "/agreements">;

export type ApiError = Problem;

export function makeApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with(
      P.instanceOf(ProcessError),
      P.instanceOf(AgreementProcessError),
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
        "Generic error while processing agreement process error"
      )
    );
}
