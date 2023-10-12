import {
  AgreementProcessError,
  ErrorTypes,
  Problem,
  makeApiProblem,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

const servicePrefix = "agreement";

export type ApiError = Problem;

export function makeApiError(error: unknown): ApiError {
  return match<unknown, ApiError>(error)
    .with(P.instanceOf(AgreementProcessError), (error) =>
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
