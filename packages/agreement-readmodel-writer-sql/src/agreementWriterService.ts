import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
} from "pagopa-interop-models";
import {
  agreementConsumerDocumentToAgreementConsumerDocumentSQL,
  agreementDocumentToAgreementDocumentSQL,
  checkMetadataVersion,
  splitAgreementIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { and, eq, lte } from "drizzle-orm";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  DrizzleReturnType,
  DrizzleTransactionType,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementWriterServiceBuilder(db: DrizzleReturnType) {
  const updateMetadataVersionInAgreementRelatedTables = async (
    tx: DrizzleTransactionType,
    agreementId: AgreementId,
    newVersion: number
  ): Promise<void> => {
    const agreementRelatedTables = [
      agreementStampInReadmodelAgreement,
      agreementAttributeInReadmodelAgreement,
      agreementConsumerDocumentInReadmodelAgreement,
      agreementContractInReadmodelAgreement,
    ];

    await tx
      .update(agreementInReadmodelAgreement)
      .set({ metadataVersion: newVersion })
      .where(
        and(
          eq(agreementInReadmodelAgreement.id, agreementId),
          lte(agreementInReadmodelAgreement.metadataVersion, newVersion)
        )
      );

    for (const table of agreementRelatedTables) {
      await tx
        .update(table)
        .set({ metadataVersion: newVersion })
        .where(
          and(
            eq(table.agreementId, agreementId),
            lte(table.metadataVersion, newVersion)
          )
        );
    }
  };

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
    async upsertConsumerDocument(
      doc: AgreementDocument,
      agreementId: AgreementId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          agreementInReadmodelAgreement,
          metadataVersion,
          agreementId
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(agreementConsumerDocumentInReadmodelAgreement)
          .where(eq(agreementConsumerDocumentInReadmodelAgreement.id, doc.id));

        const consumerDocumentSQL =
          agreementConsumerDocumentToAgreementConsumerDocumentSQL(
            doc,
            agreementId,
            metadataVersion
          );

        await tx
          .insert(agreementConsumerDocumentInReadmodelAgreement)
          .values(consumerDocumentSQL);

        await updateMetadataVersionInAgreementRelatedTables(
          tx,
          agreementId,
          metadataVersion
        );
      });
    },

    async deleteConsumerDocument(
      agreementId: AgreementId,
      consumerDocumentId: AgreementDocumentId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(agreementConsumerDocumentInReadmodelAgreement)
          .where(
            and(
              eq(
                agreementConsumerDocumentInReadmodelAgreement.id,
                consumerDocumentId
              ),
              lte(
                agreementConsumerDocumentInReadmodelAgreement.metadataVersion,
                metadataVersion
              )
            )
          );

        await updateMetadataVersionInAgreementRelatedTables(
          tx,
          agreementId,
          metadataVersion
        );
      });
    },

    async upsertContractDocument(
      contract: AgreementDocument,
      agreementId: AgreementId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          agreementInReadmodelAgreement,
          metadataVersion,
          agreementId
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(agreementContractInReadmodelAgreement)
          .where(
            and(
              eq(agreementContractInReadmodelAgreement.id, contract.id),
              eq(agreementContractInReadmodelAgreement.agreementId, agreementId)
            )
          );

        const contractDocumentSQL = agreementDocumentToAgreementDocumentSQL(
          contract,
          agreementId,
          metadataVersion
        );

        await tx
          .insert(agreementContractInReadmodelAgreement)
          .values(contractDocumentSQL);

        await updateMetadataVersionInAgreementRelatedTables(
          tx,
          agreementId,
          metadataVersion
        );
      });
    },
  };
}
export type AgreementWriterService = ReturnType<
  typeof agreementWriterServiceBuilder
>;
