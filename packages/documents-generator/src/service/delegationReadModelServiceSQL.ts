import { eq, SQL } from "drizzle-orm";
import {
  Delegation,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import {
  aggregateDelegation,
  aggregateDelegationArray,
  toDelegationAggregator,
  toDelegationAggregatorArray,
} from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getDelegationByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Delegation> | undefined> {
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
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
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
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
          delegationContractDocumentInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationContractDocumentInReadmodelDelegation.delegationId
          )
        );

      return aggregateDelegationArray(toDelegationAggregatorArray(queryResult));
    },
  };
}

export type DelegationReadModelService = ReturnType<
  typeof delegationReadModelServiceBuilder
>;
