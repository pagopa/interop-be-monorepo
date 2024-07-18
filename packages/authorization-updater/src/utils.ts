import { authorizationManagementApi } from "pagopa-interop-api-clients";
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
  PurposeVersionState,
  purposeVersionState,
  AgreementState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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
  state: AgreementState
): authorizationManagementApi.ClientComponentState =>
  match(state)
    .with(
      agreementState.active,
      () => authorizationManagementApi.ClientComponentState.Values.ACTIVE
    )
    .otherwise(
      () => authorizationManagementApi.ClientComponentState.Values.INACTIVE
    );

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

export const clientKindToApiClientKind = (
  kid: ClientKind
): authorizationManagementApi.ClientKind =>
  match<ClientKind, authorizationManagementApi.ClientKind>(kid)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const keyUseToApiKeyUse = (
  kid: KeyUse
): authorizationManagementApi.KeyUse =>
  match<KeyUse, authorizationManagementApi.KeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export const descriptorStateToClientState = (
  state: DescriptorState
): authorizationManagementApi.ClientComponentState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? authorizationManagementApi.ClientComponentState.Values.ACTIVE
    : authorizationManagementApi.ClientComponentState.Values.INACTIVE;

export const purposeStateToClientState = (
  state: PurposeVersionState
): authorizationManagementApi.ClientComponentState =>
  state === purposeVersionState.active
    ? authorizationManagementApi.ClientComponentState.Values.ACTIVE
    : authorizationManagementApi.ClientComponentState.Values.INACTIVE;
