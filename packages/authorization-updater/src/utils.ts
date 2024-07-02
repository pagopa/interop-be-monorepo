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
  PurposeV2,
  Purpose,
  fromPurposeV2,
  PurposeId,
  PurposeVersion,
  ClientV2,
  Client,
  fromClientV2,
  KeyUse,
  keyUse,
  ClientKind,
  clientKind,
  DescriptorState,
  descriptorState,
  AgreementState,
  PurposeVersionState,
  purposeVersionState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
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

export const getPurposeFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
    };
  },
  eventType: string
): Purpose => {
  if (!msg.data.purpose) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }

  return fromPurposeV2(msg.data.purpose);
};

export const getPurposeVersionFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
      versionId: string;
    };
  },
  eventType: string
): { purposeId: PurposeId; purposeVersion: PurposeVersion } => {
  const purpose = getPurposeFromEvent(msg, eventType);
  const purposeVersion = purpose.versions.find(
    (v) => v.id === msg.data.versionId
  );

  if (!purposeVersion) {
    throw missingKafkaMessageDataError("purposeVersion", eventType);
  }

  return { purposeId: purpose.id, purposeVersion };
};

export const getClientFromEvent = (
  msg: {
    data: {
      client?: ClientV2;
    };
  },
  eventType: string
): Client => {
  if (!msg.data.client) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV2(msg.data.client);
};

export const apiClientKind = {
  consumer: "CONSUMER",
  api: "API",
} as const;
export const ApiClientKind = z.enum([
  Object.values(apiClientKind)[0],
  ...Object.values(apiClientKind).slice(1),
]);
export type ApiClientKind = z.infer<typeof ApiClientKind>;

export const clientKindToApiClientKind = (kid: ClientKind): ApiClientKind =>
  match<ClientKind, ApiClientKind>(kid)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const apiKeyUse = {
  sig: "SIG",
  enc: "ENC",
} as const;
export const ApiKeyUse = z.enum([
  Object.values(apiKeyUse)[0],
  ...Object.values(apiKeyUse).slice(1),
]);
export type ApiKeyUse = z.infer<typeof ApiKeyUse>;

export const keyUseToApiKeyUse = (kid: KeyUse): ApiKeyUse =>
  match<KeyUse, ApiKeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export const clientComponentState = {
  active: "ACTIVE",
  inactive: "INACTIVE",
} as const;
export const ClientComponentState = z.enum([
  Object.values(clientComponentState)[0],
  ...Object.values(clientComponentState).slice(1),
]);
export type ClientComponentState = z.infer<typeof ClientComponentState>;

export const convertEserviceState = (
  state: DescriptorState
): ClientComponentState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? clientComponentState.active
    : clientComponentState.inactive;

export const convertAgreementState = (
  state: AgreementState
): ClientComponentState =>
  state === agreementState.active
    ? clientComponentState.active
    : clientComponentState.inactive;

export const convertPurposeState = (
  state: PurposeVersionState
): ClientComponentState =>
  state === purposeVersionState.active
    ? clientComponentState.active
    : clientComponentState.inactive;
