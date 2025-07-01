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
  APIClient,
  ConsumerClient,
  ClientKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  assertJwkKtyIsDefined,
  assertOrganizationIsClientConsumer,
} from "../../services/validators.js";

export const apiClientKindToClientKind = (
  kind: "CONSUMER" | "API"
): ClientKind =>
  match(kind)
    .with("CONSUMER", () => clientKind.consumer)
    .with("API", () => clientKind.api)
    .exhaustive();

export const keyUseToApiKeyUse = (kid: KeyUse): authorizationApi.KeyUse =>
  match<KeyUse, authorizationApi.KeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export function clientToApiClientWithKeys(
  client: Client,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.ClientWithKeys {
  return {
    // TODO Maybe also here compact?
    client: clientToApiClient(client, authData),
    keys: client.keys.map(keyToApiKey),
  };
}

export function clientToApiClient(
  client: Client,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.Client {
  assertOrganizationIsClientConsumer(authData, client);
  return match(client)
    .with({ kind: clientKind.consumer }, (c) =>
      clientToApiConsumerClient(c, authData)
    )
    .with({ kind: clientKind.api }, (c) => clientToApiAPIClient(c, authData))
    .exhaustive();
}

export function clientToApiClientOrCompactClient(
  client: Client,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.ClientOrCompactClient {
  if (authData.organizationId !== client.consumerId) {
    return {
      id: client.id,
      consumerId: client.consumerId,
    } satisfies authorizationApi.CompactClient;
  }

  return clientToApiClient(client, authData);
}

export function clientToApiConsumerClient(
  client: ConsumerClient,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.ConsumerClient {
  assertOrganizationIsClientConsumer(authData, client);

  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    createdAt: client.createdAt.toJSON(),
    users: client.users,
    purposes: client.purposes,
    description: client.description,
  };
}

export function clientToApiAPIClient(
  client: APIClient,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): authorizationApi.APIClient {
  assertOrganizationIsClientConsumer(authData, client);

  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: client.users,
    createdAt: client.createdAt.toJSON(),
    description: client.description,
    adminId: client.adminId,
  };
}

export function producerKeychainToApiProducerKeychain(
  producerKeychain: ProducerKeychain,
  { showUsers }: { showUsers: boolean }
): authorizationApi.ProducerKeychain {
  return {
    id: producerKeychain.id,
    name: producerKeychain.name,
    producerId: producerKeychain.producerId,
    users: showUsers ? producerKeychain.users : [],
    createdAt: producerKeychain.createdAt.toJSON(),
    eservices: producerKeychain.eservices,
    description: producerKeychain.description,
    keys: producerKeychain.keys.map(keyToApiKey),
  };
}

export function JsonWebKeyToApiJWKKey(
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
    key: JsonWebKeyToApiJWKKey(jwk, kid),
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
