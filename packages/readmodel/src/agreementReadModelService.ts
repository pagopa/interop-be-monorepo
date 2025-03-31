import { eq } from "drizzle-orm";
import { Agreement, AgreementId, WithMetadata } from "pagopa-interop-models";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

import {
  aggregateAgreement,
  toAgreementAggregator,
} from "./agreement/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      /*
      agreement ->1 agreement_stamp
      					->2 agreement_attribute
      					->3 agreement_document
                ->4 agreement_contract
      */
      const queryResult = await db
        .select({
          agreement: agreementInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
        })
        .from(agreementInReadmodelAgreement)
        .where(eq(agreementInReadmodelAgreement.id, agreementId))
        .leftJoin(
          // 1
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 2
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 3
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 4
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateAgreement(toAgreementAggregator(queryResult));
    },
  };
}

export type AgreementReadModelService = ReturnType<
  typeof agreementReadModelServiceBuilder
>;
