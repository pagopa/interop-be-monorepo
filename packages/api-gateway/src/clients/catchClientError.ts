import { z } from "zod";
import { ApiError, genericError } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ErrorCodes } from "../models/errors.js";

const CatchableCodes = z.enum(["404", "403"]);
type CatchableCodes = z.infer<typeof CatchableCodes>;
const ClientError = z.object({
  response: z
    .object({
      status: z.coerce.string(),
    })
    .optional(),
  message: z.string(),
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
    const { response, message } = clientError.data;
    const catchedCodeParse = CatchableCodes.safeParse(response?.status);
    if (catchedCodeParse.success) {
      const catchedCode = catchedCodeParse.data;
      logger.warn(
        `Catching API client error with code ${catchedCode} - original error: ${message}`
      );
      const error = statusCodesErrorMap[catchedCode];
      if (error) {
        return error;
      }
    }

    return genericError(message);
  }

  return genericError(
    `Unexpected error response from API Client: ${JSON.stringify(clientResult)}`
  );
}
