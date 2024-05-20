import { unsafeBrandId } from "../brandedIds.js";
import {
  ClientKindV2,
  ClientComponentStateV2,
  ClientEServiceDetailsV2,
  ClientAgreementDetailsV2,
  ClientPurposeDetailsV2,
  ClientStatesChainV2,
  ClientV2,
} from "../gen/v2/authorization/client.js";
import { KeyUseV2, KeyV2 } from "../gen/v2/authorization/key.js";
import { bigIntToDate } from "../utils.js";
import {
  Client,
  ClientAgreementDetails,
  ClientComponentState,
  ClientEserviceDetails,
  ClientKind,
  ClientPurposeDetails,
  ClientStatesChain,
  clientComponentState,
  clientKind,
} from "./client.js";
import { Key, KeyUse, keyUse } from "./key.js";

const fromKeyUseV2 = (input: KeyUseV2): KeyUse => {
  switch (input) {
    case KeyUseV2.SIG:
      return keyUse.sig;
    case KeyUseV2.ENC:
      return keyUse.enc;
  }
};

export const fromKeyV2 = (input: KeyV2): Key => ({
  ...input,
  use: fromKeyUseV2(input.use),
  createdAt: new Date(input.createdAt),
});

export const fromClientKindV2 = (input: ClientKindV2): ClientKind => {
  switch (input) {
    case ClientKindV2.CONSUMER:
      return clientKind.consumer;
    case ClientKindV2.API:
      return clientKind.api;
  }
};

export const fromClientComponentStateV2 = (
  input: ClientComponentStateV2
): ClientComponentState => {
  switch (input) {
    case ClientComponentStateV2.ACTIVE:
      return clientComponentState.active;
    case ClientComponentStateV2.INACTIVE:
      return clientComponentState.inactive;
  }
};

export const fromClientEserviceDetailsV2 = (
  input: ClientEServiceDetailsV2
): ClientEserviceDetails => ({
  eserviceId: unsafeBrandId(input.eServiceId),
  descriptorId: unsafeBrandId(input.descriptorId),
  state: fromClientComponentStateV2(input.state),
  audience: input.audience,
  voucherLifespan: input.voucherLifespan,
});

export const fromClientAgreementDetailsV2 = (
  input: ClientAgreementDetailsV2
): ClientAgreementDetails => ({
  eserviceId: unsafeBrandId(input.eServiceId),
  consumerId: unsafeBrandId(input.consumerId),
  agreementId: unsafeBrandId(input.agreementId),
  state: fromClientComponentStateV2(input.state),
});

export const fromClientPurposeDetailsV2 = (
  input: ClientPurposeDetailsV2
): ClientPurposeDetails => ({
  purposeId: unsafeBrandId(input.purposeId),
  versionId: unsafeBrandId(input.versionId),
  state: fromClientComponentStateV2(input.state),
});

export const fromClientStatesChainV2 = (
  input: ClientStatesChainV2
): ClientStatesChain => ({
  id: input.id,
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  eservice: fromClientEserviceDetailsV2(input.eService!),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  agreement: fromClientAgreementDetailsV2(input.agreement!),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  purpose: fromClientPurposeDetailsV2(input.purpose!),
});

export const fromClientV2 = (input: ClientV2): Client => ({
  ...input,
  consumerId: unsafeBrandId(input.consumerId),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  purposes: input.purposes.map((item) => fromClientStatesChainV2(item.states!)),
  kind: fromClientKindV2(input.kind),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  createdAt: bigIntToDate(input.createdAt!),
});
