import { authorizationApi } from "pagopa-interop-api-clients";
import {
  Client,
  ClientKind,
  Key,
  KeyUse,
  clientKind,
  keyUse,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const clientKindToApiClientKind = (
  kind: ClientKind
): authorizationApi.ClientKind =>
  match<ClientKind, authorizationApi.ClientKind>(kind)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const keyUseToApiKeyUse = (kid: KeyUse): authorizationApi.KeyUse =>
  match<KeyUse, authorizationApi.KeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export function clientToApiClient({
  client,
  showUsers,
}: {
  client: Client;
  showUsers: boolean;
}): authorizationApi.Client {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: showUsers ? client.users : [],
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: clientKindToApiClientKind(client.kind),
    description: client.description,
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
