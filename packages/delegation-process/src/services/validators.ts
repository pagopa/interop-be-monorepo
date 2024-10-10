import {
  DelegationKind,
  delegationState,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";
import {
  delegationAlreadyExists,
  eserviceNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export const assertEserviceExists = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<void> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
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

export const assertDelegationNotExists = async (
  delegatorId: TenantId,
  delegateId: TenantId,
  eserviceId: EServiceId,
  delegationKind: DelegationKind,
  readModelService: ReadModelService
): Promise<void> => {
  const delegation = await readModelService.findDelegation({
    delegatorId,
    delegateId,
    eserviceId,
    delegationKind,
    states: [delegationState.active, delegationState.waitingForApproval],
  });

  if (delegation) {
    throw delegationAlreadyExists(
      delegatorId,
      delegateId,
      eserviceId,
      delegation.kind,
      delegation.id
    );
  }
};
