import {
  Delegation,
  DelegationKind,
  DelegationState,
  delegationState,
  EServiceId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import {
  delegationAlreadyExists,
  delegationNotRevokable,
  delegatorAndDelegateSameIdError,
  delegatorNotAllowToRevoke,
  eserviceNotFound,
  invalidExternalOriginError,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

/* ========= STATES ========= */
export const delegationNotActivableStates: DelegationState[] = [
  delegationState.rejected,
  delegationState.revoked,
];

export const delegationRevokableStates: DelegationState[] = [
  delegationState.active,
  delegationState.waitingForApproval,
];

export const assertEserviceExists = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<void> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
  }
};

export const assertDelegatorIsNotDelegate = (
  delegatorId: TenantId,
  delegateId: TenantId
): void => {
  if (delegatorId === delegateId) {
    throw delegatorAndDelegateSameIdError();
  }
};

export const assertDelegatorIsIPA = async (
  delegator?: Tenant
): Promise<void> => {
  if (delegator?.externalId?.origin !== PUBLIC_ADMINISTRATIONS_IDENTIFIER) {
    throw invalidExternalOriginError(delegator?.externalId?.origin);
  }
};

export const assertTenantAllowedToReceiveProducerDelegation = (
  tenant: Tenant
): void => {
  const delegationFeature = tenant.features.find(
    (f) => f.type === "DelegatedProducer"
  );

  if (!delegationFeature) {
    throw tenantNotAllowedToDelegation(tenant.id);
  }
};

export const assertTenantExists = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<void> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
};

export const assertDelegationIsRevokable = (
  delegation: Delegation,
  expectedDelegatorId: TenantId
): void => {
  if (delegation.delegatorId !== expectedDelegatorId) {
    throw delegatorNotAllowToRevoke(delegation);
  }

  if (!delegationRevokableStates.includes(delegation.state)) {
    throw delegationNotRevokable(delegation);
  }
};

export const assertDelegationNotExists = async (
  delegator: Tenant,
  delegate: Tenant,
  eserviceId: EServiceId,
  delegationKind: DelegationKind,
  readModelService: ReadModelService
): Promise<void> => {
  const delegatorId = delegator.id;
  const delegateId = delegate.id;

  const delegation = await readModelService.findDelegation({
    delegatorId,
    delegateId,
    eserviceId,
    delegationKind,
    states: [delegationState.active, delegationState.waitingForApproval],
  });

  if (delegation?.data) {
    throw delegationAlreadyExists(
      delegatorId,
      delegateId,
      eserviceId,
      delegation.data.kind,
      delegation.data.id
    );
  }
};
