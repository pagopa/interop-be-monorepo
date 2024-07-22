import { AgreementEventEnvelope, generateId } from "pagopa-interop-models";
import { AgreementEvent as OutboundAgreementEvent } from "@pagopa/interop-outbound-models";
import { CreateEvent } from "pagopa-interop-commons";

export type Exact<T, U extends T> = {
  [Key in keyof U]: Key extends keyof T
    ? T[Key] extends infer TObj | undefined
      ? // @ts-expect-error eslint-disable-next-line @typescript-eslint/ban-ts-comment
        Exact<TObj, U[Key]>
      : T[Key]
    : undefined;
};

export function createAgreementOutboundEvent<
  TVersion extends number,
  TMessage extends Extract<AgreementEventEnvelope, { event_version: TVersion }>,
  TOutboundEvent extends Extract<
    OutboundAgreementEvent,
    { type: TMessage["type"]; event_version: TVersion }
  >
>({
  eventVersion,
  message,
  outboundData,
}: {
  eventVersion: TVersion;
  message: TMessage;
  outboundData: TOutboundEvent["data"];
}): CreateEvent<TOutboundEvent> {
  return {
    streamId: message.stream_id,
    version: message.version,
    event: {
      type: message.type,
      event_version: eventVersion,
      data: outboundData,
    },
    correlationId: message.correlation_id ?? generateId(),
  } as CreateEvent<TOutboundEvent>;
}
