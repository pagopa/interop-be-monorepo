import {
  AgreementEventEnvelopeV2,
  AgreementV2,
  EService,
  DelegationEventEnvelopeV2,
  DelegationV2,
  EServiceEventEnvelopeV2,
  EServiceId,
  EServiceTemplateEventEnvelopeV2,
  EServiceTemplateV2,
  EServiceV2,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
  PurposeId,
  PurposeV2,
  AuthorizationEventEnvelopeV2,
  ClientV2,
  ProducerKeychainV2,
} from "pagopa-interop-models";
import { purposeEServiceNotFound } from "../models/errors.js";

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

export function assertPurposeExistsInEvent(
  event: PurposeEventEnvelopeV2
): asserts event is PurposeEventEnvelopeV2 & {
  data: { purpose: PurposeV2 };
} {
  if (!event.data.purpose) {
    throw missingKafkaMessageDataError("purpose", event.type);
  }
}

export function assertPurposeEServiceExists(
  eservice: EService | undefined,
  eserviceId: EServiceId,
  purposeId: PurposeId
): asserts eservice is EService {
  if (!eservice) {
    throw purposeEServiceNotFound(eserviceId, purposeId);
  }
}

export function assertDelegationExistsInEvent(
  event: DelegationEventEnvelopeV2
): asserts event is DelegationEventEnvelopeV2 & {
  data: { delegation: DelegationV2 };
} {
  if (!event.data.delegation) {
    throw missingKafkaMessageDataError("delegation", event.type);
  }
}

export function assertEServiceTemplateExistsInEvent(
  event: EServiceTemplateEventEnvelopeV2
): asserts event is EServiceTemplateEventEnvelopeV2 & {
  data: { eserviceTemplate: EServiceTemplateV2 };
} {
  if (!event.data.eserviceTemplate) {
    throw missingKafkaMessageDataError("eserviceTemplate", event.type);
  }
}

export function assertClientExistsInEvent(
  event: AuthorizationEventEnvelopeV2 & {
    data: { client?: ClientV2 };
  }
): asserts event is AuthorizationEventEnvelopeV2 & {
  data: { client: ClientV2 };
} {
  if (!event.data.client) {
    throw missingKafkaMessageDataError("client", event.type);
  }
}

export function assertProducerKeychainExistsInEvent(
  event: AuthorizationEventEnvelopeV2 & {
    data: { producerKeychain?: ProducerKeychainV2 };
  }
): asserts event is AuthorizationEventEnvelopeV2 & {
  data: { producerKeychain: ProducerKeychainV2 };
} {
  if (!event.data.producerKeychain) {
    throw missingKafkaMessageDataError("producerKeychain", event.type);
  }
}
