import {
  Client,
  ClientKind,
  KeyUse,
  clientKind,
  keyUse,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiClient,
  ApiClientWithKeys,
  ApiClientKind,
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
  { includeKeys }: { includeKeys: true }
): ApiClientWithKeys;
export function clientToApiClient(
  client: Client,
  { includeKeys }: { includeKeys: false }
): ApiClient;
export function clientToApiClient(
  client: Client,
  { includeKeys }: { includeKeys: boolean }
): ApiClientWithKeys | ApiClient {
  return {
    id: client.id,
    name: client.name,
    consumerId: client.consumerId,
    users: client.users,
    createdAt: client.createdAt.toJSON(),
    purposes: client.purposes,
    kind: ClientKindToApiClientKind(client.kind),
    description: client.description ? client.description : undefined,
    ...(includeKeys ? { keys: client.keys } : {}),
  };
}
