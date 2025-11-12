import { Delegation, DelegationId } from "pagopa-interop-models";
import { eq, and, lte } from "drizzle-orm";
import {
  checkMetadataVersion,
  splitDelegationIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationSignedContractDocumentInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationWriterServiceBuilder(readModelDB: DrizzleReturnType) {
  return {
    async upsertDelegation(
      delegation: Delegation,
      metadataVersion: number
    ): Promise<void> {
      await readModelDB.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          delegationInReadmodelDelegation,
          metadataVersion,
          delegation.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(delegationInReadmodelDelegation)
          .where(eq(delegationInReadmodelDelegation.id, delegation.id));

        const {
          delegationSQL,
          stampsSQL,
          contractDocumentsSQL,
          contractSignedDocumentsSQL,
        } = splitDelegationIntoObjectsSQL(delegation, metadataVersion);

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
        for (const docSignedSQL of contractSignedDocumentsSQL) {
          await tx
            .insert(delegationSignedContractDocumentInReadmodelDelegation)
            .values(docSignedSQL);
        }
      });
    },
    async deleteDelegationById(
      delegationId: DelegationId,
      metadataVersion: number
    ): Promise<void> {
      await readModelDB
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
export type DelegationWriterService = ReturnType<
  typeof delegationWriterServiceBuilder
>;
