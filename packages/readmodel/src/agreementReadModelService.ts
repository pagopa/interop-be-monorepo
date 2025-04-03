import { and, eq, lte } from "drizzle-orm";
import { Agreement, AgreementId, WithMetadata } from "pagopa-interop-models";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { splitAgreementIntoObjectsSQL } from "./agreement/splitters.js";
import {
  aggregateAgreement,
  toAgreementAggregator,
} from "./agreement/aggregators.js";
import { checkMetadataVersion } from "./utils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async upsertAgreement(
      agreement: Agreement,
      metadataVersion: number
    ): Promise<void> {
      const {
        agreementSQL,
        stampsSQL,
        attributesSQL,
        consumerDocumentsSQL,
        contractSQL,
      } = splitAgreementIntoObjectsSQL(agreement, metadataVersion);

      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          agreementInReadmodelAgreement,
          metadataVersion,
          agreement.id
        );

        if (shouldUpsert) {
          await tx
            .delete(agreementInReadmodelAgreement)
            .where(eq(agreementInReadmodelAgreement.id, agreement.id));

          await tx.insert(agreementInReadmodelAgreement).values(agreementSQL);

          for (const stampSQL of stampsSQL) {
            await tx
              .insert(agreementStampInReadmodelAgreement)
              .values(stampSQL);
          }

          for (const attributeSQL of attributesSQL) {
            await tx
              .insert(agreementAttributeInReadmodelAgreement)
              .values(attributeSQL);
          }

          for (const docSQL of consumerDocumentsSQL) {
            await tx
              .insert(agreementConsumerDocumentInReadmodelAgreement)
              .values(docSQL);
          }
          if (contractSQL !== undefined) {
            await tx
              .insert(agreementContractInReadmodelAgreement)
              .values(contractSQL);
          }
        }
      });
    },
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
    async deleteAgreementById(
      agreementId: AgreementId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(agreementInReadmodelAgreement)
        .where(
          and(
            eq(agreementInReadmodelAgreement.id, agreementId),
            lte(agreementInReadmodelAgreement.metadataVersion, metadataVersion)
          )
        );
    },
  };
}

export type AgreementReadModelService = ReturnType<
  typeof agreementReadModelServiceBuilder
>;
