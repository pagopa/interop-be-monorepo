import { authorizationApi } from "pagopa-interop-api-clients";
import { Client, ProducerKeychain } from "pagopa-interop-models";
import { keyToApiKey } from "../src/model/domain/apiConverter.js";

export function testToPartialClient(
  client: Client
): authorizationApi.PartialClient {
  return {
    id: client.id,
    consumerId: client.consumerId,
    kind: client.kind.toUpperCase() as authorizationApi.ClientKind,
    visibility: authorizationApi.Visibility.Enum.PARTIAL,
  };
}

export function testToFullClient(client: Client): authorizationApi.FullClient {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: client.users,
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: client.kind.toUpperCase() as authorizationApi.ClientKind,
    description: client.description,
    adminId: client.adminId,
    visibility: authorizationApi.Visibility.Enum.FULL,
  };
}

export function testToPartialProducerKeychain(
  producerKeychain: ProducerKeychain
): authorizationApi.PartialProducerKeychain {
  return {
    id: producerKeychain.id,
    producerId: producerKeychain.producerId,
    visibility: authorizationApi.Visibility.Enum.PARTIAL,
  };
}

export function testToFullProducerKeychain(
  producerKeychain: ProducerKeychain
): authorizationApi.FullProducerKeychain {
  return {
    id: producerKeychain.id,
    name: producerKeychain.name,
    producerId: producerKeychain.producerId,
    users: producerKeychain.users,
    createdAt: producerKeychain.createdAt.toJSON(),
    description: producerKeychain.description,
    keys: producerKeychain.keys.map(keyToApiKey),
    eservices: producerKeychain.eservices,
    visibility: authorizationApi.Visibility.Enum.FULL,
  };
}
