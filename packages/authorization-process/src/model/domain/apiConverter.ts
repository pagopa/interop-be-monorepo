import {
  Client,
  ClientKind,
  Key,
  KeyUse,
  clientKind,
  keyUse,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiClient,
  ApiClientWithKeys,
  ApiClientKind,
  ApiKey,
  ApiKeyUse,
} from "./models.js";

export const ClientKindToApiClientKind = (kind: ClientKind): ApiClientKind =>
  match<ClientKind, ApiClientKind>(kind)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const KeyUseToApiKeyUse = (kid: KeyUse): ApiKeyUse =>
  match<KeyUse, ApiKeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export function clientToApiClient(
  client: Client,
  { includeKeys, showUsers }: { includeKeys: true; showUsers: boolean }
): ApiClientWithKeys;
export function clientToApiClient(
  client: Client,
  { includeKeys, showUsers }: { includeKeys: false; showUsers: boolean }
): ApiClient;
export function clientToApiClient(
  client: Client,
  { includeKeys, showUsers }: { includeKeys: boolean; showUsers: boolean }
): ApiClientWithKeys | ApiClient {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: showUsers ? client.users : [],
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: ClientKindToApiClientKind(client.kind),
    description: client.description,
    ...(includeKeys ? { keys: client.keys } : {}),
  };
}

export const keyToApiKey = (key: Key): ApiKey => ({
  name: key.name,
  createdAt: key.createdAt.toJSON(),
  kid: key.kid,
  encodedPem: key.encodedPem,
  algorithm: key.algorithm,
  use: KeyUseToApiKeyUse(key.use),
  userId: key.userId,
});
