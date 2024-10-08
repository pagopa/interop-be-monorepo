import { z } from "zod";
import {
  ApiError,
  CommonErrorCodes,
  genericError,
} from "pagopa-interop-models";
import { ErrorCodes } from "../models/errors.js";

const CatchableCodes = z.enum(["400", "403", "404", "409"]);
type CatchableCodes = z.infer<typeof CatchableCodes>;
const ClientError = z.object({
  message: z.string(),
  response: z.object({
    status: z.coerce.string().pipe(CatchableCodes),
  }),
});

type StatusCodeErrorsMap = Record<
  CatchableCodes,
  ApiError<ErrorCodes | CommonErrorCodes> | undefined
>;
export function clientStatusCodeToError(
  clientResult: unknown,
  statusCodesErrorMap: Partial<StatusCodeErrorsMap>
): Error {
  const clientError = ClientError.safeParse(clientResult);

  if (clientError.success) {
    const error = statusCodesErrorMap[clientError.data.response.status];
    if (error) {
      return error;
    }
  }

  if (clientResult instanceof Error) {
    return clientResult;
    // Returning the original error as it is,
    // so that it can be thrown, handled and logged
  }

  return genericError(
    `Unexpected error response from API Client: ${JSON.stringify(clientResult)}`
  );
}
