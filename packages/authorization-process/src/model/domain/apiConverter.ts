import { JsonWebKey } from "crypto";
import { authorizationApi } from "pagopa-interop-api-clients";
import {
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
} from "pagopa-interop-commons";
import {
  Client,
  Key,
  KeyUse,
  clientKind,
  keyUse,
  ProducerKeychain,
  ClientJWKKey,
  ProducerJWKKey,
  ClientKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { assertJwkKtyIsDefined } from "../../services/validators.js";

const clientKindToApiClientKind = (
  kind: ClientKind
): authorizationApi.ClientKind =>
  match<ClientKind, authorizationApi.ClientKind>(kind)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const apiClientKindToClientKind = (
  kind: authorizationApi.ClientKind
): ClientKind =>
  match<authorizationApi.ClientKind, ClientKind>(kind)
    .with("CONSUMER", () => clientKind.consumer)
    .with("API", () => clientKind.api)
    .exhaustive();

const keyUseToApiKeyUse = (kid: KeyUse): authorizationApi.KeyUse =>
  match<KeyUse, authorizationApi.KeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export function clientToApiClientWithKeys(
  client: Client,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.ClientWithKeys {
  return {
    client: clientToApiClient(client, authData),
    keys: client.keys.map(keyToApiKey),
  };
}

export function clientToApiFullVisibilityClient(
  client: Client
): authorizationApi.FullClient {
  return {
    visibility: authorizationApi.Visibility.Enum.FULL,
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: client.users,
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: clientKindToApiClientKind(client.kind),
    description: client.description,
    adminId: client.adminId,
  };
}

export function clientToApiClient(
  client: Client,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.Client {
  if (authData.organizationId !== client.consumerId) {
    return {
      visibility: authorizationApi.Visibility.Enum.PARTIAL,
      id: client.id,
      consumerId: client.consumerId,
      kind: clientKindToApiClientKind(client.kind),
    } satisfies authorizationApi.PartialClient;
  }

  return clientToApiFullVisibilityClient(client);
}

export function producerKeychainToApiFullVisibilityProducerKeychain(
  producerKeychain: ProducerKeychain
): authorizationApi.FullProducerKeychain {
  return {
    visibility: authorizationApi.Visibility.Enum.FULL,
    id: producerKeychain.id,
    name: producerKeychain.name,
    producerId: producerKeychain.producerId,
    users: producerKeychain.users,
    createdAt: producerKeychain.createdAt.toJSON(),
    eservices: producerKeychain.eservices,
    description: producerKeychain.description,
    keys: producerKeychain.keys.map(keyToApiKey),
  };
}

export function producerKeychainToApiProducerKeychain(
  producerKeychain: ProducerKeychain,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.ProducerKeychain {
  if (authData.organizationId !== producerKeychain.producerId) {
    return {
      visibility: authorizationApi.Visibility.Enum.PARTIAL,
      id: producerKeychain.id,
      producerId: producerKeychain.producerId,
    } satisfies authorizationApi.PartialProducerKeychain;
  }

  return producerKeychainToApiFullVisibilityProducerKeychain(producerKeychain);
}

function jsonWebKeyToApiJWKKey(
  jwk: JsonWebKey,
  kid: string
): authorizationApi.JWKKey {
  assertJwkKtyIsDefined(jwk);

  return {
    ...jwk,
    kid,
    use: "sig",
  };
}

export function jwkAndClientToApiKeyWithClient(
  jwk: JsonWebKey,
  kid: string,
  client: Client,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.KeyWithClient {
  return {
    key: jsonWebKeyToApiJWKKey(jwk, kid),
    client: clientToApiClient(client, authData),
  };
}

export const keyToApiKey = (key: Key): authorizationApi.Key => ({
  name: key.name,
  createdAt: key.createdAt.toJSON(),
  kid: key.kid,
  encodedPem: key.encodedPem,
  algorithm: key.algorithm,
  use: keyUseToApiKeyUse(key.use),
  userId: key.userId,
});

export const ApiKeyUseToKeyUse = (kid: authorizationApi.KeyUse): KeyUse =>
  match<authorizationApi.KeyUse, KeyUse>(kid)
    .with("ENC", () => keyUse.enc)
    .with("SIG", () => keyUse.sig)
    .exhaustive();

export const clientJWKToApiClientJWK = (
  jwk: ClientJWKKey
): authorizationApi.ClientJWK => ({
  clientId: jwk.clientId,
  jwk: {
    kid: jwk.kid,
    kty: jwk.kty,
    alg: jwk.alg,
    use: jwk.use,
    e: jwk.e,
    n: jwk.n,
  },
});

export const producerJWKToApiProducerJWK = (
  jwk: ProducerJWKKey
): authorizationApi.ProducerJWK => ({
  producerKeychainId: jwk.producerKeychainId,
  jwk: {
    kid: jwk.kid,
    kty: jwk.kty,
    alg: jwk.alg,
    use: jwk.use,
    e: jwk.e,
    n: jwk.n,
  },
});
