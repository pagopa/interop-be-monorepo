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
  aggregateDelegationsArray,
  toDelegationAggregator,
  toDelegationAggregatorArray,
} from "./delegation/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertDelegation(
      delegation: WithMetadata<Delegation>
    ): Promise<void> {
      const { delegationSQL, stampsSQL, contractDocumentsSQL } =
        splitDelegationIntoObjectsSQL(
          delegation.data,
          delegation.metadata.version
        );

      await db.transaction(async (tx) => {
        await tx
          .delete(delegationInReadmodelDelegation)
          .where(eq(delegationInReadmodelDelegation.id, delegation.data.id));

        await tx.insert(delegationInReadmodelDelegation).values(delegationSQL);

        for (const stampSQL of stampsSQL) {
          await tx
            .insert(delegationStampInReadmodelDelegation)
            .values(stampSQL);
        }

        for (const docSQL of contractDocumentsSQL) {
          await tx
            .insert(delegationContractDocumentInReadmodelDelegation)
            .values(docSQL);
        }
      });
    },
    async getDelegationById(
      delegationId: DelegationId
    ): Promise<WithMetadata<Delegation> | undefined> {
      /*
        delegation -> 1 delegation_stamp
                  -> 2 delegation_contract_document
      */
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

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateDelegation(toDelegationAggregator(queryResult));
    },
    async deleteDelegationById(delegationId: DelegationId): Promise<void> {
      await db
        .delete(delegationInReadmodelDelegation)
        .where(eq(delegationInReadmodelDelegation.id, delegationId));
    },
    async getAllDelegations(): Promise<Array<WithMetadata<Delegation>>> {
      const queryResult = await db
        .select({
          delegation: delegationInReadmodelDelegation,
          delegationStamp: delegationStampInReadmodelDelegation,
          delegationContractDocument:
            delegationContractDocumentInReadmodelDelegation,
        })
        .from(delegationInReadmodelDelegation)
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

      return aggregateDelegationsArray(
        toDelegationAggregatorArray(queryResult)
      );
    },
  };
}

export type DelegationReadModelService = ReturnType<
  typeof delegationReadModelServiceBuilder
>;
