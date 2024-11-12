import {
  Delegation,
  DelegationId,
  DelegationKind,
  DelegationState,
  EServiceId,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { delegationNotFound } from "../model/domain/errors.js";
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
