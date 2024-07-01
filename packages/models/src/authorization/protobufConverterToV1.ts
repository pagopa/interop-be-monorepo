import { match } from "ts-pattern";
import { z } from "zod";
import { KeyUseV1, KeyV1 } from "../gen/v1/authorization/key.js";
import {
  ClientComponentStateV1,
  ClientKindV1,
  ClientStatesChainV1,
  ClientV1,
} from "../gen/v1/authorization/client.js";
import { dateToBigInt } from "../utils.js";
import { PurposeId, generateId } from "../brandedIds.js";
import { Key, KeyUse, keyUse } from "./key.js";
import { Client, ClientKind, clientKind } from "./client.js";

const clientComponentState = {
  active: "Active",
  inactive: "Inactive",
} as const;
const ClientComponentState = z.enum([
  Object.values(clientComponentState)[0],
  ...Object.values(clientComponentState).slice(1),
]);
type ClientComponentState = z.infer<typeof ClientComponentState>;

export const toKeyUseV1 = (input: KeyUse): KeyUseV1 =>
  match(input)
    .with(keyUse.sig, () => KeyUseV1.SIG)
    .with(keyUse.enc, () => KeyUseV1.ENC)
    .exhaustive();

export const toKeyV1 = (input: Key): KeyV1 => ({
  ...input,
  use: toKeyUseV1(input.use),
  createdAt: input.createdAt.toISOString(),
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

export const toClientStatesChainV1 = (
  input: PurposeId
): ClientStatesChainV1 => ({
  id: generateId(),
  eService: undefined,
  agreement: undefined,
  purpose: {
    purposeId: input,
    versionId: generateId(),
    state: toClientComponentStateV1(clientComponentState.active),
  },
});

export const toClientV1 = (input: Client): ClientV1 => ({
  ...input,
  consumerId: input.consumerId,
  purposes: input.purposes.map((item) => ({
    states: toClientStatesChainV1(item),
  })),
  kind: toClientKindV1(input.kind),
  createdAt: dateToBigInt(input.createdAt),
  relationships: [],
});
