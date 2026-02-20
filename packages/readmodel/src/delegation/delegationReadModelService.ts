import { eq, SQL } from "drizzle-orm";
import {
  Delegation,
  DelegationId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationSignedContractDocumentInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import {
  aggregateDelegation,
  aggregateDelegationArray,
  toDelegationAggregator,
  toDelegationAggregatorArray,
} from "./delegation/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
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
          delegationSignedContractDocument:
            delegationSignedContractDocumentInReadmodelDelegation,
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
        )
        .leftJoin(
          // 3
          delegationSignedContractDocumentInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationSignedContractDocumentInReadmodelDelegation.delegationId
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
          delegationSignedContractDocument:
            delegationSignedContractDocumentInReadmodelDelegation,
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
        )
        .leftJoin(
          delegationSignedContractDocumentInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationSignedContractDocumentInReadmodelDelegation.delegationId
          )
        );

      return aggregateDelegationArray(toDelegationAggregatorArray(queryResult));
    },
  };
}

export type DelegationReadModelService = ReturnType<
  typeof delegationReadModelServiceBuilder
>;
