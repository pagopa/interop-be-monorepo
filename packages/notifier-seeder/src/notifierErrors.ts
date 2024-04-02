import { InternalError } from "pagopa-interop-models";

const notifierErrorCode = {
  eventV1ConversionError: "eventV1ConversionError",
} as const;

export type NotifierErrorCode = keyof typeof notifierErrorCode;

export function eventV1ConversionError(
  message: string
): InternalError<NotifierErrorCode> {
  return new InternalError({
    code: "eventV1ConversionError",
    detail: `Error during event V1 conversion with message: ${message}`,
  });
}
