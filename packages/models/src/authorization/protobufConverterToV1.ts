import { match } from "ts-pattern";
import { KeyUseV1, KeyV1 } from "../gen/v1/authorization/key.js";
import {
  ClientAgreementDetailsV1,
  ClientComponentStateV1,
  ClientEServiceDetailsV1,
  ClientKindV1,
  ClientPurposeDetailsV1,
  ClientStatesChainV1,
  ClientV1,
} from "../gen/v1/authorization/client.js";
import { dateToBigInt } from "../utils.js";
import { Key, KeyUse, keyUse } from "./key.js";
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

const toKeyUseV1 = (input: KeyUse): KeyUseV1 =>
  match(input)
    .with(keyUse.sig, () => KeyUseV1.SIG)
    .with(keyUse.enc, () => KeyUseV1.ENC)
    .exhaustive();

export const toKeyV1 = (input: Key): KeyV1 => ({
  ...input,
  use: toKeyUseV1(input.use),
  createdAt: input.createdAt.toString(),
});

export const toClientKindV1 = (input: ClientKind): ClientKindV1 =>
  match(input)
    .with(clientKind.consumer, () => ClientKindV1.CONSUMER)
    .with(clientKind.api, () => ClientKindV1.API)
    .exhaustive();

export const toClientComponentStateV1 = (
  input: ClientComponentState
): ClientComponentStateV1 =>
  match(input)
    .with(clientComponentState.active, () => ClientComponentStateV1.ACTIVE)
    .with(clientComponentState.inactive, () => ClientComponentStateV1.INACTIVE)
    .exhaustive();

export const toClientEserviceDetailsV1 = (
  input: ClientEserviceDetails
): ClientEServiceDetailsV1 => ({
  eServiceId: input.eserviceId,
  descriptorId: input.descriptorId,
  state: toClientComponentStateV1(input.state),
  audience: input.audience,
  voucherLifespan: input.voucherLifespan,
});

export const toClientAgreementDetailsV1 = (
  input: ClientAgreementDetails
): ClientAgreementDetailsV1 => ({
  eServiceId: input.eserviceId,
  consumerId: input.consumerId,
  agreementId: input.agreementId,
  state: toClientComponentStateV1(input.state),
});

export const toClientPurposeDetailsV1 = (
  input: ClientPurposeDetails
): ClientPurposeDetailsV1 => ({
  purposeId: input.purposeId,
  versionId: input.versionId,
  state: toClientComponentStateV1(input.state),
});

export const toClientStatesChainV1 = (
  input: ClientStatesChain
): ClientStatesChainV1 => ({
  id: input.id,
  eService: toClientEserviceDetailsV1(input.eservice),
  agreement: toClientAgreementDetailsV1(input.agreement),
  purpose: toClientPurposeDetailsV1(input.purpose),
});

export const toClientV1 = (input: Client): ClientV1 => ({
  ...input,
  consumerId: input.consumerId,
  purposes: input.purposes.map((item) => ({
    states: toClientStatesChainV1(item),
  })),
  kind: toClientKindV1(input.kind),
  createdAt: dateToBigInt(input.createdAt),
});
