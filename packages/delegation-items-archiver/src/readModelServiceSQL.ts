import {
  Agreement,
  agreementState,
  Delegation,
  DelegationId,
  Purpose,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  PurposeReadModelService,
} from "pagopa-interop-readmodel";
import { and, eq, exists, inArray } from "drizzle-orm";
import {
  agreementInReadmodelAgreement,
  purposeInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  purposeReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  agreementReadModelServiceSQL: AgreementReadModelService;
  purposeReadModelServiceSQL: PurposeReadModelService;
}) {
  return {
    async getPurposes(delegationId: DelegationId): Promise<Purpose[]> {
      const purposesWithMetadata =
        await purposeReadModelServiceSQL.getPurposesByFilter(
          and(
            eq(purposeInReadmodelPurpose.delegationId, delegationId),
            exists(
              readModelDB
                .select()
                .from(purposeVersionInReadmodelPurpose)
                .where(
                  and(
                    eq(
                      purposeVersionInReadmodelPurpose.purposeId,
                      purposeInReadmodelPurpose.id
                    ),
                    inArray(purposeVersionInReadmodelPurpose.state, [
                      purposeVersionState.active,
                      purposeVersionState.suspended,
                      purposeVersionState.draft,
                      purposeVersionState.waitingForApproval,
                    ])
                  )
                )
            )
          )
        );

      return purposesWithMetadata.map((purpose) => purpose.data);
    },
    async getAgreements(delegation: Delegation): Promise<Agreement[]> {
      const agreementsWithMetadata =
        await agreementReadModelServiceSQL.getAgreementsByFilter(
          and(
            eq(agreementInReadmodelAgreement.eserviceId, delegation.eserviceId),
            eq(
              agreementInReadmodelAgreement.consumerId,
              delegation.delegatorId
            ),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
              agreementState.draft,
              agreementState.missingCertifiedAttributes,
              agreementState.pending,
            ])
          )
        );

      return agreementsWithMetadata.map((agreement) => agreement.data);
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
