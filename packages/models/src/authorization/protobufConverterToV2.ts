import { match } from "ts-pattern";
import { dateToBigInt } from "../utils.js";
import { ClientKindV2, ClientV2 } from "../gen/v2/authorization/client.js";
import {
  KeyUseV2,
  ClientKeyV2,
  ProducerKeychainKeyV2,
} from "../gen/v2/authorization/key.js";
import { ProducerKeychainV2 } from "../gen/v2/authorization/producer-keychain.js";
import { ClientKey } from "./client.js";
import { KeyUse, keyUse } from "./key.js";
import { Client, ClientKind, clientKind } from "./client.js";
import { ProducerKeychain, ProducerKeychainKey } from "./producerKeychain.js";

const toKeyUseV2 = (input: KeyUse): KeyUseV2 =>
  match(input)
    .with(keyUse.sig, () => KeyUseV2.SIG)
    .with(keyUse.enc, () => KeyUseV2.ENC)
    .exhaustive();

export const toClientKeyV2 = (input: ClientKey): ClientKeyV2 => ({
  ...input,
  use: toKeyUseV2(input.use),
  createdAt: dateToBigInt(input.createdAt),
});

export const toClientKindV2 = (input: ClientKind): ClientKindV2 =>
  match(input)
    .with(clientKind.consumer, () => ClientKindV2.CONSUMER)
    .with(clientKind.api, () => ClientKindV2.API)
    .exhaustive();

export const toClientV2 = (input: Client): ClientV2 => ({
  ...input,
  consumerId: input.consumerId,
  kind: toClientKindV2(input.kind),
  createdAt: dateToBigInt(input.createdAt),
  keys: input.keys.map(toClientKeyV2),
});

export const toProducerKeychainKeyV2 = (
  input: ProducerKeychainKey
  // eslint-disable-next-line sonarjs/no-identical-functions
): ProducerKeychainKeyV2 => ({
  ...input,
  use: toKeyUseV2(input.use),
  createdAt: dateToBigInt(input.createdAt),
});

export const toProducerKeychainV2 = (
  input: ProducerKeychain
): ProducerKeychainV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
  keys: input.keys.map(toProducerKeychainKeyV2),
});
