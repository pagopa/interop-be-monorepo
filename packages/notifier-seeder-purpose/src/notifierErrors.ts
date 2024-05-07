import { InternalError } from "pagopa-interop-models";

type NotifierErrorCode = "eventV1ConversionError";

export function eventV1ConversionError(
  message: string
): InternalError<NotifierErrorCode> {
  return new InternalError({
    code: "eventV1ConversionError",
    detail: `Error during event V1 conversion with message: ${message}`,
  });
}
