import { unsafeBrandId } from "../brandedIds.js";
import {
  ClientAgreementDetailsV1,
  ClientComponentStateV1,
  ClientEServiceDetailsV1,
  ClientKindV1,
  ClientPurposeDetailsV1,
  ClientStatesChainV1,
  ClientV1,
} from "../gen/v1/authorization/client.js";
import { KeyUseV1, KeyV1 } from "../gen/v1/authorization/key.js";
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

const fromKeyUseV1 = (input: KeyUseV1): KeyUse => {
  switch (input) {
    case KeyUseV1.SIG:
      return keyUse.sig;
    case KeyUseV1.ENC:
      return keyUse.enc;
    case KeyUseV1.UNSPECIFIED$: {
      throw new Error("Unspecified key use");
    }
  }
};

export const fromKeyV1 = (input: KeyV1): Key => ({
  ...input,
  use: fromKeyUseV1(input.use),
  createdAt: new Date(input.createdAt),
});

export const fromClientKindV1 = (input: ClientKindV1): ClientKind => {
  switch (input) {
    case ClientKindV1.API:
      return clientKind.api;
    case ClientKindV1.CONSUMER:
      return clientKind.consumer;
    case ClientKindV1.UNSPECIFIED$: {
      throw new Error("Unspecified client kind");
    }
  }
};

export const fromClientComponentStateV1 = (
  input: ClientComponentStateV1
): ClientComponentState => {
  switch (input) {
    case ClientComponentStateV1.ACTIVE:
      return clientComponentState.active;
    case ClientComponentStateV1.INACTIVE:
      return clientComponentState.inactive;
    case ClientComponentStateV1.UNSPECIFIED$: {
      throw new Error("Unspecified client component state");
    }
  }
};

export const fromClientEserviceDetailsV1 = (
  input: ClientEServiceDetailsV1
): ClientEserviceDetails => ({
  eserviceId: unsafeBrandId(input.eServiceId),
  descriptorId: unsafeBrandId(input.descriptorId),
  state: fromClientComponentStateV1(input.state),
  audience: input.audience,
  voucherLifespan: input.voucherLifespan,
});

export const fromClientAgreementDetailsV1 = (
  input: ClientAgreementDetailsV1
): ClientAgreementDetails => ({
  eserviceId: unsafeBrandId(input.eServiceId),
  consumerId: unsafeBrandId(input.consumerId),
  agreementId: unsafeBrandId(input.agreementId),
  state: fromClientComponentStateV1(input.state),
});

export const fromClientPurposeDetailsV1 = (
  input: ClientPurposeDetailsV1
): ClientPurposeDetails => ({
  purposeId: unsafeBrandId(input.purposeId),
  versionId: unsafeBrandId(input.versionId),
  state: fromClientComponentStateV1(input.state),
});

export const fromClientStatesChainV1 = (
  input: ClientStatesChainV1
): ClientStatesChain => ({
  id: input.id,
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  eservice: fromClientEserviceDetailsV1(input.eService!),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  agreement: fromClientAgreementDetailsV1(input.agreement!),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  purpose: fromClientPurposeDetailsV1(input.purpose!),
});

export const fromClientV1 = (input: ClientV1): Client => ({
  ...input,
  consumerId: unsafeBrandId(input.consumerId),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  purposes: input.purposes.map((item) => fromClientStatesChainV1(item.states!)),
  kind: fromClientKindV1(input.kind),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  createdAt: bigIntToDate(input.createdAt!),
});
