import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Delegation, DelegationId, WithMetadata } from "pagopa-interop-models";
import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
} from "pagopa-interop-readmodel-models";
import { splitDelegationIntoObjectsSQL } from "./delegation/splitters.js";
import {
  aggregateDelegation,
  fromJoinToAggregatorDelegation,
} from "./delegation/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addEDelegation(delegation: WithMetadata<Delegation>): Promise<void> {
      const {
        delegationSQL,
        delegationStampsSQL,
        delegationContractDocumentsSQL,
      } = splitDelegationIntoObjectsSQL(
        delegation.data,
        delegation.metadata.version
      );

      await db.transaction(async (tx) => {
        await tx.insert(delegationInReadmodelDelegation).values(delegationSQL);

        for (const stamps of delegationStampsSQL) {
          await tx.insert(delegationStampInReadmodelDelegation).values(stamps);
        }

        for (const doc of delegationContractDocumentsSQL) {
          await tx
            .insert(delegationContractDocumentInReadmodelDelegation)
            .values(doc);
        }
      });
    },
    async getDelegationById(
      delegationId: DelegationId
    ): Promise<WithMetadata<Delegation>> {
      const queryResult = await db
        .select({
          delegation: delegationInReadmodelDelegation,
          delegationStamp: delegationStampInReadmodelDelegation,
          delegationContractDocument:
            delegationContractDocumentInReadmodelDelegation,
        })
        .from(delegationInReadmodelDelegation)
        .where(eq(delegationInReadmodelDelegation.id, delegationId))
        .leftJoin(
          // 1
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
          // 2
          delegationContractDocumentInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationContractDocumentInReadmodelDelegation.delegationId
          )
        );

      const aggregatorInput = fromJoinToAggregatorDelegation(queryResult);

      return aggregateDelegation(aggregatorInput);
    },
    async deleteDelegationById(delegationId: DelegationId): Promise<void> {
      await db
        .delete(delegationInReadmodelDelegation)
        .where(eq(delegationInReadmodelDelegation.id, delegationId));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
