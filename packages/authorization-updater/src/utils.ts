import {
  EServiceV2,
  EServiceId,
  Descriptor,
  missingKafkaMessageDataError,
  EService,
  fromEServiceV2,
  AgreementV2,
  Agreement,
  fromAgreementV2,
  agreementState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ApiClientComponentState, ApiClientComponent } from "./model/models.js";

export const getDescriptorFromEvent = (
  msg: {
    data: {
      descriptorId: string;
      eservice?: EServiceV2;
    };
  },
  eventType: string
): {
  eserviceId: EServiceId;
  descriptor: Descriptor;
} => {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }

  const eservice: EService = fromEServiceV2(msg.data.eservice);
  const descriptor = eservice.descriptors.find(
    (d) => d.id === msg.data.descriptorId
  );

  if (!descriptor) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }

  return { eserviceId: eservice.id, descriptor };
};

export const getAgreementFromEvent = (
  msg: {
    data: {
      agreement?: AgreementV2;
    };
  },
  eventType: string
): Agreement => {
  if (!msg.data.agreement) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }

  return fromAgreementV2(msg.data.agreement);
};

export const agreementStateToClientState = (
  agreement: Agreement
): ApiClientComponentState =>
  match(agreement.state)
    .with(agreementState.active, () => ApiClientComponent.Values.ACTIVE)
    .otherwise(() => ApiClientComponent.Values.INACTIVE);
