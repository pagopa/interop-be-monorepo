import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Agreement, AgreementId, WithMetadata } from "pagopa-interop-models";
import {
  agreementAttributeInReadmodelAgreement,
  agreementDocumentInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import {
  aggregateAgreement,
  fromJoinToAggregator,
} from "./agreement/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addAgreement(agreement: WithMetadata<Agreement>): Promise<void> {
      const {
        agreementSQL,
        agreementStampsSQL,
        agreementAttributesSQL,
        agreementDocumentsSQL,
      } = splitAgreementIntoObjectsSQL(
        agreement.data,
        agreement.metadata.version
      );

      await db.transaction(async (tx) => {
        await tx.insert(agreementInReadmodelAgreement).values(agreementSQL);

        for (const stamp of agreementStampsSQL) {
          await tx.insert(agreementStampInReadmodelAgreement).values(stamp);
        }

        for (const attr of agreementAttributesSQL) {
          await tx.insert(agreementAttributeInReadmodelAgreement).values(attr);
        }

        for (const doc of agreementDocumentsSQL) {
          await tx.insert(agreementDocumentInReadmodelAgreement).values(doc);
        }
      });
    },
    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement>> {
      /*
      agreement ->1 agreement_stamp
      					->2 agreement_attribute
      					->3 agreement_document
      */
      const queryResult = await db
        .select({
          agreement: agreementInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          document: agreementDocumentInReadmodelAgreement,
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
          agreementDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementDocumentInReadmodelAgreement.agreementId
          )
        );

      const aggregatorInput = fromJoinToAggregator(queryResult);

      return aggregateAgreement(aggregatorInput);
    },
    async deleteAgreeementById(agreementId: AgreementId): Promise<void> {
      await db
        .delete(agreementInReadmodelAgreement)
        .where(eq(agreementInReadmodelAgreement.id, agreementId));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
