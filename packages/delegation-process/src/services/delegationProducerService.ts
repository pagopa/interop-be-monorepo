import {
  Delegation,
  DelegationId,
  DelegationState,
  TenantId,
} from "pagopa-interop-models";
import { delegationNotFound } from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  readModelService: ReadModelService
) {
  return {
    async getDelegationById(delegationId: DelegationId): Promise<Delegation> {
      const delegation = await readModelService.getDelegationById(delegationId);

      if (!delegation) {
        throw delegationNotFound(delegationId);
      }

      return delegation;
    },
    async getDelegations(
      delegateIds: TenantId[],
      delegatorIds: TenantId[],
      delegationStates: DelegationState[],
      offset: number,
      limit: number
    ): Promise<Delegation[]> {
      return readModelService.getDelegations({
        delegateIds,
        delegatorIds,
        delegationStates,
        offset,
        limit,
      });
    },
  };
}
