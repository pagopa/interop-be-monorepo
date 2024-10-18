import {
  Delegation,
  DelegationId,
  DelegationKind,
  DelegationState,
  TenantId,
} from "pagopa-interop-models";
import { delegationNotFound } from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(readModelService: ReadModelService) {
  return {
    async getDelegationById(delegationId: DelegationId): Promise<Delegation> {
      const delegation = await readModelService.getDelegationById(delegationId);

      if (!delegation?.data) {
        throw delegationNotFound(delegationId);
      }

      return delegation.data;
    },
    // eslint-disable-next-line max-params
    async getDelegations(
      delegateIds: TenantId[],
      delegatorIds: TenantId[],
      delegationStates: DelegationState[],
      kind: DelegationKind | undefined,
      offset: number,
      limit: number
    ): Promise<Delegation[]> {
      return readModelService.getDelegations({
        delegateIds,
        delegatorIds,
        delegationStates,
        kind,
        offset,
        limit,
      });
    },
  };
}
