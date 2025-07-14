import { authorizationApi, delegationApi } from "pagopa-interop-api-clients";
import {
  unexpectedClientKind,
  unexpectedDelegationKind,
} from "../../model/errors.js";

export function assertDelegationKindIs<K extends delegationApi.DelegationKind>(
  delegation: delegationApi.Delegation,
  expectedKind: K
): asserts delegation is delegationApi.Delegation & { kind: K } {
  if (delegation.kind !== expectedKind) {
    throw unexpectedDelegationKind(delegation);
  }
}

export function assertClientKindIs<K extends authorizationApi.ClientKind>(
  client: authorizationApi.Client,
  expectedKind: K
): asserts client is authorizationApi.Client & { kind: K } {
  if (client.kind !== expectedKind) {
    throw unexpectedClientKind(client);
  }
}
