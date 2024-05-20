import { match } from "ts-pattern";
import { dateToBigInt } from "../utils.js";
import {
  ClientAgreementDetailsV2,
  ClientComponentStateV2,
  ClientEServiceDetailsV2,
  ClientKindV2,
  ClientPurposeDetailsV2,
  ClientStatesChainV2,
  ClientV2,
} from "../gen/v2/authorization/client.js";
import { KeyUseV2, KeyV2 } from "../gen/v2/authorization/key.js";
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

const toKeyUseV2 = (input: KeyUse): KeyUseV2 =>
  match(input)
    .with(keyUse.sig, () => KeyUseV2.SIG)
    .with(keyUse.enc, () => KeyUseV2.ENC)
    .exhaustive();

export const toKeyV2 = (input: Key): KeyV2 => ({
  ...input,
  use: toKeyUseV2(input.use),
  createdAt: input.createdAt.toString(),
});

export const toClientKindV2 = (input: ClientKind): ClientKindV2 =>
  match(input)
    .with(clientKind.consumer, () => ClientKindV2.CONSUMER)
    .with(clientKind.api, () => ClientKindV2.API)
    .exhaustive();

export const toClientComponentStateV2 = (
  input: ClientComponentState
): ClientComponentStateV2 =>
  match(input)
    .with(clientComponentState.active, () => ClientComponentStateV2.ACTIVE)
    .with(clientComponentState.inactive, () => ClientComponentStateV2.INACTIVE)
    .exhaustive();

export const toClientEserviceDetailsV2 = (
  input: ClientEserviceDetails
): ClientEServiceDetailsV2 => ({
  eServiceId: input.eserviceId,
  descriptorId: input.descriptorId,
  state: toClientComponentStateV2(input.state),
  audience: input.audience,
  voucherLifespan: input.voucherLifespan,
});

export const toClientAgreementDetailsV2 = (
  input: ClientAgreementDetails
): ClientAgreementDetailsV2 => ({
  eServiceId: input.eserviceId,
  consumerId: input.consumerId,
  agreementId: input.agreementId,
  state: toClientComponentStateV2(input.state),
});

export const toClientPurposeDetailsV2 = (
  input: ClientPurposeDetails
): ClientPurposeDetailsV2 => ({
  purposeId: input.purposeId,
  versionId: input.versionId,
  state: toClientComponentStateV2(input.state),
});

export const toClientStatesChainV2 = (
  input: ClientStatesChain
): ClientStatesChainV2 => ({
  id: input.id,
  eService: toClientEserviceDetailsV2(input.eservice),
  agreement: toClientAgreementDetailsV2(input.agreement),
  purpose: toClientPurposeDetailsV2(input.purpose),
});

export const toClientV2 = (input: Client): ClientV2 => ({
  ...input,
  consumerId: input.consumerId,
  purposes: input.purposes.map((item) => ({
    states: toClientStatesChainV2(item),
  })),
  kind: toClientKindV2(input.kind),
  createdAt: dateToBigInt(input.createdAt),
});
