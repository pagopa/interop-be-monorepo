import { InternalError, parseErrorMessage } from "pagopa-interop-models";

type QueueManagerErrorCode =
  | "queueManagerSendError"
  | "queueManagerReceiveError";

export class QueueManagerError extends InternalError<QueueManagerErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: QueueManagerErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function queueManagerSendError(
  queueUrl: string,
  error: unknown
): QueueManagerError {
  return new QueueManagerError({
    code: "queueManagerSendError",
    detail: `Error sending message to queue ${queueUrl}: ${parseErrorMessage(
      error
    )}`,
  });
}

export function queueManagerReceiveError(
  queueUrl: string,
  error: unknown
): QueueManagerError {
  return new QueueManagerError({
    code: "queueManagerReceiveError",
    detail: `Error receiving message from queue ${queueUrl}: ${parseErrorMessage(
      error
    )}`,
  });
}
