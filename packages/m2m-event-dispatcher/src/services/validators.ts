import {
  AgreementEventEnvelopeV2,
  AgreementV2,
  EService,
  EServiceEventEnvelopeV2,
  EServiceId,
  EServiceV2,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
  PurposeId,
  PurposeV2,
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
