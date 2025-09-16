import { InternalError } from "pagopa-interop-models";

type M2MEventsDispatcherErrorCode = "";

export class M2MEventsDispatcherError extends InternalError<M2MEventsDispatcherErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: M2MEventsDispatcherErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}
