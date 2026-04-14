import {
  agreementContractInReadmodelAgreement,
  agreementSignedContractInReadmodelAgreement,
  delegationContractDocumentInReadmodelDelegation,
  delegationSignedContractDocumentInReadmodelDelegation,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
  type DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { and, eq, gte, lt } from "drizzle-orm";

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getAgreementsContracts(from: Date, to: Date) {
      return await readModelDB
        .select({
          unsigned: agreementContractInReadmodelAgreement,
          signed: agreementSignedContractInReadmodelAgreement,
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

    async getPurposeDocuments(from: Date, to: Date) {
      return await readModelDB
        .select({
          unsigned: purposeVersionDocumentInReadmodelPurpose,
          signed: purposeVersionSignedDocumentInReadmodelPurpose,
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

    async getDelegationContracts(from: Date, to: Date) {
      return await readModelDB
        .select({
          unsigned: delegationContractDocumentInReadmodelDelegation,
          signed: delegationSignedContractDocumentInReadmodelDelegation,
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
