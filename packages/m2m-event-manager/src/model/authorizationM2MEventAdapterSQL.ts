import {
  ClientM2MEventSQL,
  KeyM2MEventSQL,
  ProducerKeychainM2MEventSQL,
  ProducerKeyM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";
import {
  ClientM2MEvent,
  KeyM2MEvent,
  ProducerKeychainM2MEvent,
  ProducerKeyM2MEvent,
} from "pagopa-interop-models";

export function fromKeyM2MEventSQL(event: KeyM2MEventSQL): KeyM2MEvent {
  return KeyM2MEvent.parse(event);
}

export function fromClientM2MEventSQL(
  event: ClientM2MEventSQL
): ClientM2MEvent {
  return ClientM2MEvent.parse(event);
}

export function fromProducerKeyM2MEventSQL(
  event: ProducerKeyM2MEventSQL
): ProducerKeyM2MEvent {
  return ProducerKeyM2MEvent.parse(event);
}

export function fromProducerKeychainM2MEventSQL(
  event: ProducerKeychainM2MEventSQL
): ProducerKeychainM2MEvent {
  return ProducerKeychainM2MEvent.parse(event);
}
