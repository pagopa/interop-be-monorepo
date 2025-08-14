import { delegationApi } from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { M2MAdminAuthData, M2MAuthData } from "pagopa-interop-commons";
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

export function assertActiveConsumerDelegateForEservice(
  requesterTenantId: TenantId,
  eserviceId: string,
  delegation: delegationApi.Delegation
): void {
  if (
    delegation.kind !==
      delegationApi.DelegationKind.Values.DELEGATED_CONSUMER ||
    delegation.state !== delegationApi.DelegationState.Values.ACTIVE ||
    delegation.delegateId !== requesterTenantId ||
    delegation.eserviceId !== eserviceId
  ) {
    throw notAnActiveConsumerDelegation(
      requesterTenantId,
      eserviceId,
      delegation
    );
  }
}

export function assertRequesterIsDelegateConsumer(
  authData: M2MAdminAuthData | M2MAuthData,
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
