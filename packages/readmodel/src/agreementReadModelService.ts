import { and, eq, lte, SQL } from "drizzle-orm";
import {
  Agreement,
  AgreementId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
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
  aggregateAgreementArray,
  toAgreementAggregator,
  toAgreementAggregatorArray,
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

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(agreementInReadmodelAgreement)
          .where(eq(agreementInReadmodelAgreement.id, agreement.id));

        await tx.insert(agreementInReadmodelAgreement).values(agreementSQL);

        for (const stampSQL of stampsSQL) {
          await tx.insert(agreementStampInReadmodelAgreement).values(stampSQL);
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
      });
    },
    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      return this.getAgreementByFilter(
        eq(agreementInReadmodelAgreement.id, agreementId)
      );
    },
    async getAgreementByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Agreement> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }
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
        .where(filter)
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
    async getAgreementsByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Agreement>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          agreement: agreementInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
        })
        .from(agreementInReadmodelAgreement)
        .where(filter)
        .leftJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        );

      return aggregateAgreementArray(toAgreementAggregatorArray(queryResult));
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
