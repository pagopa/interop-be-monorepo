import { delegationApi } from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import {
  tenantAuthorizationMismatch,
  unexpectedDelegationKind,
} from "../../model/errors.js";

export function assertTenantDeclaredAttributeAuthorization(
  callerTenantId: TenantId,
  requestedTenantId: TenantId,
  delegationId?: string,
  delegation?: delegationApi.Delegation
): void {
  // Caller can always operate on their own declared attributes
  if (callerTenantId === requestedTenantId) {
    return;
  }

  // If no delegationId is provided for different tenants, throw authorization error
  if (!delegationId) {
    throw tenantAuthorizationMismatch(
      callerTenantId,
      requestedTenantId,
      delegationId
    );
  }

  // If delegation is provided, validate it
  if (
    delegation &&
    (delegation.kind !==
      delegationApi.DelegationKind.Values.DELEGATED_PRODUCER ||
      delegation.state !== delegationApi.DelegationState.Values.ACTIVE ||
      delegation.delegateId !== callerTenantId ||
      delegation.delegatorId !== requestedTenantId)
  ) {
    throw unexpectedDelegationKind(delegation);
  }
}
