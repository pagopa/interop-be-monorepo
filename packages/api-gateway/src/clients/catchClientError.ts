import { z } from "zod";
import { ApiError, genericError } from "pagopa-interop-models";
import { ErrorCodes } from "../models/errors.js";

const CatchableCodes = z.enum(["404", "403"]);
type CatchableCodes = z.infer<typeof CatchableCodes>;
const ClientError = z.object({
  response: z.object({
    status: z.coerce.string().pipe(CatchableCodes),
  }),
});
type StatusCodeErrorsMap = Record<
  CatchableCodes,
  ApiError<ErrorCodes> | undefined
>;
export const clientStatusCodeToError = (
  clientResult: unknown,
  statusCodesErrorMap: Partial<StatusCodeErrorsMap>
): Error => {
  const clientError = ClientError.safeParse(clientResult);

  if (clientError.success) {
    const { status } = clientError.data.response;
    const error = statusCodesErrorMap[status];
    if (error) {
      return error;
    }
  }

  return genericError("Unexpected error receved from API client");
};
