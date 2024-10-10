import {
  DelegationKind,
  DelegationState,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";

export type GetDelegationsFilters = {
  eserviceId?: EServiceId;
  delegatorId?: TenantId;
  delegateId?: TenantId;
  delegationKind?: DelegationKind;
  states?: DelegationState[];
};
