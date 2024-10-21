import {
  bffApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";

export function toBffDelegationApiDelegation(
  delegation: delegationApi.Delegation,
  delegator: tenantApi.Tenant,
  delegate: tenantApi.Tenant,
  eservice: catalogApi.EService
): bffApi.Delegation {
  return {
    id: delegation.id,
    eservice: {
      id: eservice.id,
      name: eservice.name,
      description: eservice.description,
    },
    delegate: {
      id: delegate.id,
      name: delegate.name,
    },
    delegator: {
      id: delegator.id,
      name: delegator.name,
    },
    contract: delegation.contract,
    submittedAt: delegation.submittedAt,
    rejectionReason: delegation.rejectionReason,
    state: delegation.state,
  };
}
