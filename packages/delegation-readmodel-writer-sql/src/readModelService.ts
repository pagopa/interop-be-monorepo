import { drizzle } from "drizzle-orm/node-postgres";
import { Delegation, DelegationId, WithMetadata } from "pagopa-interop-models";
import { DelegationReadModelService } from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  delegationReadModelService: DelegationReadModelService
) {
  return {
    async upsertDelegation(
      delegation: Delegation,
      metadataVersion: number
    ): Promise<void> {
      return await delegationReadModelService.upsertDelegation(
        delegation,
        metadataVersion
      );
    },
    async getDelegationById(
      delegationId: DelegationId
    ): Promise<WithMetadata<Delegation> | undefined> {
      return await delegationReadModelService.getDelegationById(delegationId);
    },
    async deleteDelegation(
      delegationId: DelegationId,
      metadataVersion: number
    ): Promise<void> {
      return await delegationReadModelService.deleteDelegationById(
        delegationId,
        metadataVersion
      );
    },
  };
}

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
