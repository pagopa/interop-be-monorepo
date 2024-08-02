import {
  ClientReadModel,
  ClientKeyReadModel,
  ProducerKeychainReadModel,
  ProducerKeyReadModel,
} from "../read-models/authorizationReadModel.js";
import { Client, ClientKey } from "./client.js";
import { ProducerKeychain, ProducerKey } from "./producerKeychain.js";

export const toReadModelClientKey = (key: ClientKey): ClientKeyReadModel => ({
  ...key,
  createdAt: key.createdAt.toISOString(),
});

export const toReadModelClient = (client: Client): ClientReadModel => ({
  ...client,
  createdAt: client.createdAt.toISOString(),
  keys: client.keys.map(toReadModelClientKey),
});

export const toReadModelProducerKey = (
  key: ProducerKey
): ProducerKeyReadModel => ({
  ...key,
  createdAt: key.createdAt.toISOString(),
});

export const toReadModelProducerKeychain = (
  producerKeychain: ProducerKeychain
): ProducerKeychainReadModel => ({
  ...producerKeychain,
  createdAt: producerKeychain.createdAt.toISOString(),
  keys: producerKeychain.keys.map(toReadModelProducerKey),
});
