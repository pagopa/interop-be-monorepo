import { InternalError, parseErrorMessage } from "pagopa-interop-models";

type SqsErrorCode =
  | "sqsReceiveError"
  | "sqsDeleteError"
  | "sqsProcessError"
  | "sqsMessageFormatError";

export class SqsError extends InternalError<SqsErrorCode> {
  constructor({ code, detail }: { code: SqsErrorCode; detail: string }) {
    super({ code, detail });
  }
}

export function sqsReceiveError(queueUrl: string, error: unknown): SqsError {
  return new SqsError({
    code: "sqsReceiveError",
    detail: `Error receiving message from queue ${queueUrl}: ${parseErrorMessage(
      error
    )}`,
  });
}

export function sqsDeleteError(queueUrl: string, error: unknown): SqsError {
  return new SqsError({
    code: "sqsDeleteError",
    detail: `Error deleting message from queue ${queueUrl}: ${parseErrorMessage(
      error
    )}`,
  });
}

export function sqsProcessError(queueUrl: string, error: unknown): SqsError {
  return new SqsError({
    code: "sqsProcessError",
    detail: `Error processing message from queue ${queueUrl}: ${parseErrorMessage(
      error
    )}`,
  });
}

export function sqsMessageFormatError(
  queueUrl: string,
  error: unknown
): SqsError {
  return new SqsError({
    code: "sqsMessageFormatError",
    detail: `Malformed SQS message received from queue ${queueUrl}: ${parseErrorMessage(
      error
    )}`,
  });
}
