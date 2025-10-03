import {
  AgreementEventEnvelopeV2,
  AgreementV2,
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

export function assertAgreementExistsInEvent(
  event: AgreementEventEnvelopeV2
): asserts event is AgreementEventEnvelopeV2 & {
  data: { agreement: AgreementV2 };
} {
  if (!event.data.agreement) {
    throw missingKafkaMessageDataError("agreement", event.type);
  }
}
