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
  differentEServiceProducer,
  eserviceNotFound,
  incorrectState,
  invalidExternalOriginError,
  operationRestrictedToDelegate,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

/* ========= STATES ========= */
export const delegationNotActivableStates: DelegationState[] = [
  delegationState.rejected,
  delegationState.revoked,
];

export const activeDelegationStates: DelegationState[] = [
  delegationState.waitingForApproval,
  delegationState.active,
];

export const assertEserviceExists = async (
  delegatorId: TenantId,
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<void> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
  }

  if (eservice.data.producerId !== delegatorId) {
    throw differentEServiceProducer(delegatorId);
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

  if (!activeDelegationStates.includes(delegation.state)) {
    throw delegationNotRevokable(delegation);
  }
};

export const assertDelegationNotExists = async (
  delegator: Tenant,
  eserviceId: EServiceId,
  delegationKind: DelegationKind,
  readModelService: ReadModelService
): Promise<void> => {
  const delegatorId = delegator.id;

  const delegations = await readModelService.findDelegations({
    delegatorId,
    eserviceId,
    delegationKind,
    states: [delegationState.active, delegationState.waitingForApproval],
  });

  if (delegations.length > 0) {
    throw delegationAlreadyExists(delegatorId, eserviceId, delegationKind);
  }
};

export const assertIsDelegate = (
  delegation: Delegation,
  delegateId: TenantId
): void => {
  if (delegation.delegateId !== delegateId) {
    throw operationRestrictedToDelegate(delegateId, delegation.id);
  }
};

export const assertIsState = (
  state: DelegationState,
  delegation: Delegation
): void => {
  if (delegation.state !== state) {
    throw incorrectState(
      delegation.id,
      delegation.state,
      delegationState.waitingForApproval
    );
  }
};