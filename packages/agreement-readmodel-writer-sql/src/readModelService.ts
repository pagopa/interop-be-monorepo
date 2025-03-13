import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  agreementDocumentToAgreementDocumentSQL,
} from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, lte } from "drizzle-orm";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
} from "../../readmodel-models/dist/drizzle/schema.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  db: ReturnType<typeof drizzle>,
  agreementReadModelService: AgreementReadModelService
) {
  return {
    async upsertAgreement(
      agreement: Agreement,
      metadataVersion: number
    ): Promise<void> {
      return await agreementReadModelService.upsertAgreement(
        agreement,
        metadataVersion
      );
    },
    async deleteAgreement(
      agreementId: AgreementId,
      metadataVersion: number
    ): Promise<void> {
      return await agreementReadModelService.deleteAgreementById(
        agreementId,
        metadataVersion
      );
    },
    async upsertConsumerDocument(
      doc: AgreementDocument,
      agreementId: AgreementId,
      metadataVersion: number
    ): Promise<void> {
      const consumerDocumentSQL = agreementDocumentToAgreementDocumentSQL(
        doc,
        agreementId,
        metadataVersion
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(agreementConsumerDocumentInReadmodelAgreement)
          .where(
            and(
              eq(
                agreementConsumerDocumentInReadmodelAgreement.id,
                consumerDocumentSQL.id
              ),
              lte(
                agreementConsumerDocumentInReadmodelAgreement.metadataVersion,
                metadataVersion
              )
            )
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
      const contractDocumentSQL = agreementDocumentToAgreementDocumentSQL(
        contract,
        agreementId,
        metadataVersion
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(agreementContractInReadmodelAgreement)
          .where(
            and(
              eq(
                agreementContractInReadmodelAgreement.id,
                contractDocumentSQL.id
              ),
              lte(
                agreementContractInReadmodelAgreement.metadataVersion,
                metadataVersion
              )
            )
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

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

const updateMetadataVersionInAgreementRelatedTables = async (
  tx: TransactionType,
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

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
