import { z } from "zod";
import { ApiError, genericError } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ErrorCodes } from "../models/errors.js";

const CatchableCodes = z.enum(["404", "403"]);
type CatchableCodes = z.infer<typeof CatchableCodes>;
const ClientError = z.object({
  message: z.string(),
  response: z.object({
    status: z.coerce.string().pipe(CatchableCodes),
  }),
});

type StatusCodeErrorsMap = Record<
  CatchableCodes,
  ApiError<ErrorCodes> | undefined
>;
export function clientStatusCodeToError(
  clientResult: unknown,
  logger: Logger,
  statusCodesErrorMap: Partial<StatusCodeErrorsMap>
): Error {
  const clientError = ClientError.safeParse(clientResult);

  if (clientError.success) {
    const {
      response: { status },
      message,
    } = clientError.data;
    logger.warn(
      `Catching API client error with code ${status} - original error: ${message}`
    );
    const error = statusCodesErrorMap[status];
    if (error) {
      return error;
    }
  }

  if (clientResult instanceof Error) {
    return clientResult;
    // Returning the original error as it is,
    // so that it can thrown, logged and handled as it is
  }

  return genericError(
    `Unexpected error response from API Client: ${JSON.stringify(clientResult)}`
  );
}
