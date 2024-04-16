import { P, match } from "ts-pattern";
import {
  ApiError,
  CommonErrorCodes,
  Problem,
  errorCodes,
  genericError,
} from "pagopa-interop-models";
import { LoggerCtx } from "./index.js";

export function makeApiProblemBuilder<T extends string>(
  logger: {
    error: (
      msg: (typeof logger.error.arguments)[0],
      loggerCtx: LoggerCtx
    ) => void;
  },
  errors: {
    [K in T]: string;
  }
): (
  error: unknown,
  httpMapper: (apiError: ApiError<T | CommonErrorCodes>) => number,
  loggerCtx: LoggerCtx
) => Problem {
  const allErrors = { ...errorCodes, ...errors };
  return (error, httpMapper, loggerCtx) => {
    const makeProblem = (
      httpStatus: number,
      { code, title, detail, correlationId }: ApiError<T | CommonErrorCodes>
    ): Problem => ({
      type: "about:blank",
      title,
      status: httpStatus,
      detail,
      correlationId,
      errors: [
        {
          code: allErrors[code],
          detail,
        },
      ],
    });

    const problem = match<unknown, Problem>(error)
      .with(P.instanceOf(ApiError<T | CommonErrorCodes>), (error) =>
        makeProblem(httpMapper(error), error)
      )
      .otherwise(() => makeProblem(500, genericError("Unexpected error")));

    logger.error(
      `- ${problem.title} - ${problem.detail} - orignal error: ${error}`,
      loggerCtx
    );
    return problem;
  };
}
