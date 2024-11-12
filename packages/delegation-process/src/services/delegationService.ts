import {
  Delegation,
  DelegationId,
  DelegationKind,
  DelegationState,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  delegationNotFound,
  eserviceNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export const retrieveDelegationById = async (
  readModelService: ReadModelService,
  delegationId: DelegationId
): Promise<WithMetadata<Delegation>> => {
  const delegation = await readModelService.getDelegationById(delegationId);
  if (!delegation?.data) {
    throw delegationNotFound(delegationId);
  }
  return delegation;
};

export const retrieveTenantById = async (
  readModelService: ReadModelService,
  tenantId: TenantId
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEserviceById = async (
  readModelService: ReadModelService,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw eserviceNotFound(id);
  }
  return eservice.data;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(readModelService: ReadModelService) {
  return {
    async getDelegationById(delegationId: DelegationId): Promise<Delegation> {
      const delegation = await retrieveDelegationById(
        readModelService,
        delegationId
      );
      return delegation.data;
    },
    // eslint-disable-next-line max-params
    async getDelegations({
      delegateIds,
      delegatorIds,
      delegationStates,
      eserviceIds,
      kind,
      offset,
      limit,
    }: {
      delegateIds: TenantId[];
      delegatorIds: TenantId[];
      delegationStates: DelegationState[];
      eserviceIds: EServiceId[];
      kind: DelegationKind | undefined;
      offset: number;
      limit: number;
    }): Promise<Delegation[]> {
      return readModelService.getDelegations({
        delegateIds,
        delegatorIds,
        eserviceIds,
        delegationStates,
        kind,
        offset,
        limit,
      });
    },
  };
}
