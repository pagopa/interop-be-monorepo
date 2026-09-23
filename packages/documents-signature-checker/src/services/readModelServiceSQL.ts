import { and, gte, lt, eq } from "drizzle-orm";
import {
  agreementContractInReadmodelAgreement,
  agreementSignedContractInReadmodelAgreement,
  delegationContractDocumentInReadmodelDelegation,
  delegationSignedContractDocumentInReadmodelDelegation,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
  type DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

/** Half open interval `[from, to)` the job checks documents in. */
export type TimeRange = {
  from: Date;
  to: Date;
};

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    /**
     * Agreement contracts created in the range, each with the signed contract of
     * the same agreement when the readmodel holds one. `signedId` is null exactly
     * when no signed record exists.
     */
    async getAgreementContracts({ from, to }: TimeRange) {
      return await readModelDB
        .select({
          agreementId: agreementContractInReadmodelAgreement.agreementId,
          unsignedPath: agreementContractInReadmodelAgreement.path,
          createdAt: agreementContractInReadmodelAgreement.createdAt,
          signedId: agreementSignedContractInReadmodelAgreement.id,
          signedPath: agreementSignedContractInReadmodelAgreement.path,
        })
        .from(agreementContractInReadmodelAgreement)
        .leftJoin(
          agreementSignedContractInReadmodelAgreement,
          eq(
            agreementContractInReadmodelAgreement.agreementId,
            agreementSignedContractInReadmodelAgreement.agreementId
          )
        )
        .where(
          and(
            gte(
              agreementContractInReadmodelAgreement.createdAt,
              from.toISOString()
            ),
            lt(
              agreementContractInReadmodelAgreement.createdAt,
              to.toISOString()
            )
          )
        );
    },

    async getPurposeVersionDocuments({ from, to }: TimeRange) {
      return await readModelDB
        .select({
          purposeId: purposeVersionDocumentInReadmodelPurpose.purposeId,
          purposeVersionId:
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId,
          unsignedPath: purposeVersionDocumentInReadmodelPurpose.path,
          createdAt: purposeVersionDocumentInReadmodelPurpose.createdAt,
          signedId: purposeVersionSignedDocumentInReadmodelPurpose.id,
          signedPath: purposeVersionSignedDocumentInReadmodelPurpose.path,
        })
        .from(purposeVersionDocumentInReadmodelPurpose)
        .leftJoin(
          purposeVersionSignedDocumentInReadmodelPurpose,
          and(
            eq(
              purposeVersionDocumentInReadmodelPurpose.purposeId,
              purposeVersionSignedDocumentInReadmodelPurpose.purposeId
            ),
            eq(
              purposeVersionDocumentInReadmodelPurpose.purposeVersionId,
              purposeVersionSignedDocumentInReadmodelPurpose.purposeVersionId
            )
          )
        )
        .where(
          and(
            gte(
              purposeVersionDocumentInReadmodelPurpose.createdAt,
              from.toISOString()
            ),
            lt(
              purposeVersionDocumentInReadmodelPurpose.createdAt,
              to.toISOString()
            )
          )
        );
    },

    async getDelegationContracts({ from, to }: TimeRange) {
      return await readModelDB
        .select({
          delegationId:
            delegationContractDocumentInReadmodelDelegation.delegationId,
          kind: delegationContractDocumentInReadmodelDelegation.kind,
          unsignedPath: delegationContractDocumentInReadmodelDelegation.path,
          createdAt: delegationContractDocumentInReadmodelDelegation.createdAt,
          signedId: delegationSignedContractDocumentInReadmodelDelegation.id,
          signedPath:
            delegationSignedContractDocumentInReadmodelDelegation.path,
        })
        .from(delegationContractDocumentInReadmodelDelegation)
        .leftJoin(
          delegationSignedContractDocumentInReadmodelDelegation,
          and(
            eq(
              delegationContractDocumentInReadmodelDelegation.delegationId,
              delegationSignedContractDocumentInReadmodelDelegation.delegationId
            ),
            eq(
              delegationContractDocumentInReadmodelDelegation.kind,
              delegationSignedContractDocumentInReadmodelDelegation.kind
            )
          )
        )
        .where(
          and(
            gte(
              delegationContractDocumentInReadmodelDelegation.createdAt,
              from.toISOString()
            ),
            lt(
              delegationContractDocumentInReadmodelDelegation.createdAt,
              to.toISOString()
            )
          )
        );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
