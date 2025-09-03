import { delegationApi } from "pagopa-interop-api-clients";
import { M2MAdminAuthData } from "pagopa-interop-commons";
import {
  notAnActiveConsumerDelegation,
  requesterIsNotTheDelegateConsumer,
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

export function assertRequesterIsDelegateConsumerForEservice(
  authData: M2MAdminAuthData,
  eserviceId: string,
  delegation: delegationApi.Delegation
): void {
  assertRequesterIsDelegateConsumer(authData, delegation);
  if (delegation.eserviceId !== eserviceId) {
    throw notAnActiveConsumerDelegation(
      authData.organizationId,
      eserviceId,
      delegation
    );
  }
}

export function assertRequesterIsDelegateConsumer(
  authData: M2MAdminAuthData,
  delegation: delegationApi.Delegation
): void {
  if (
    delegation.kind !==
      delegationApi.DelegationKind.Values.DELEGATED_CONSUMER ||
    delegation.state !== delegationApi.DelegationState.Values.ACTIVE ||
    delegation.delegateId !== authData.organizationId
  ) {
    throw requesterIsNotTheDelegateConsumer(delegation);
  }
}
