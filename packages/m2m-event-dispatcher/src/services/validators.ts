import {
  EServiceEventEnvelopeV2,
  EServiceV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";

export function assertEServiceExistsInEvent(
  event: EServiceEventEnvelopeV2
): asserts event is EServiceEventEnvelopeV2 & {
  data: { eservice: EServiceV2 };
} {
  if (!event.data.eservice) {
    throw missingKafkaMessageDataError("eservice", event.type);
  }
}
