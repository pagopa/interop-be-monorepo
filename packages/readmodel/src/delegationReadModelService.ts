import { and, eq, lte, SQL } from "drizzle-orm";
import {
  Delegation,
  DelegationId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { splitDelegationIntoObjectsSQL } from "./delegation/splitters.js";
import {
  aggregateDelegation,
  aggregateDelegationArray,
  toDelegationAggregator,
  toDelegationAggregatorArray,
} from "./delegation/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertDelegation(
      delegation: Delegation,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const existingMetadataVersion = (
          await tx
            .select({
              metadataVersion: delegationInReadmodelDelegation.metadataVersion,
            })
            .from(delegationInReadmodelDelegation)
            .where(eq(delegationInReadmodelDelegation.id, delegation.id))
        )[0]?.metadataVersion;

        if (
          !existingMetadataVersion ||
          existingMetadataVersion <= metadataVersion
        ) {
          await tx
            .delete(delegationInReadmodelDelegation)
            .where(eq(delegationInReadmodelDelegation.id, delegation.id));

          const { delegationSQL, stampsSQL, contractDocumentsSQL } =
            splitDelegationIntoObjectsSQL(delegation, metadataVersion);

          await tx
            .insert(delegationInReadmodelDelegation)
            .values(delegationSQL);

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
        }
      });
    },
    async getDelegationById(
      delegationId: DelegationId
    ): Promise<WithMetadata<Delegation> | undefined> {
      return await this.getDelegationByFilter(
        eq(delegationInReadmodelDelegation.id, delegationId)
      );
    },
    async getDelegationByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Delegation> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

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
        .where(filter)
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
    async getDelegationsByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Delegation>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          delegation: delegationInReadmodelDelegation,
          delegationStamp: delegationStampInReadmodelDelegation,
          delegationContractDocument:
            delegationContractDocumentInReadmodelDelegation,
        })
        .from(delegationInReadmodelDelegation)
        .where(filter)
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

      return aggregateDelegationArray(toDelegationAggregatorArray(queryResult));
    },
    async deleteDelegationById(
      delegationId: DelegationId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(delegationInReadmodelDelegation)
        .where(
          and(
            eq(delegationInReadmodelDelegation.id, delegationId),
            lte(
              delegationInReadmodelDelegation.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}

export type DelegationReadModelService = ReturnType<
  typeof delegationReadModelServiceBuilder
>;
