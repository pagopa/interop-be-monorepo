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
export function readModelServiceBuilder(
  db: DrizzleReturnType,
  agreementReadModelService: AgreementReadModelService
) {
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
      return await agreementReadModelService.upsertAgreement(
        agreement,
        metadataVersion
      );
    },
    async deleteAgreementById(
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
      await db.transaction(async (tx) => {
        const existingMetadataVersion: number | undefined = (
          await tx
            .select({
              metadataVersion:
                agreementConsumerDocumentInReadmodelAgreement.metadataVersion,
            })
            .from(agreementConsumerDocumentInReadmodelAgreement)
            .where(eq(agreementConsumerDocumentInReadmodelAgreement.id, doc.id))
        )[0]?.metadataVersion;

        if (
          !existingMetadataVersion ||
          existingMetadataVersion <= metadataVersion
        ) {
          await tx
            .delete(agreementConsumerDocumentInReadmodelAgreement)
            .where(
              and(eq(agreementConsumerDocumentInReadmodelAgreement.id, doc.id))
            );

          const consumerDocumentSQL = agreementDocumentToAgreementDocumentSQL(
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
        }
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
        const existingMetadataVersion: number | undefined = (
          await tx
            .select({
              metadataVersion:
                agreementContractInReadmodelAgreement.metadataVersion,
            })
            .from(agreementContractInReadmodelAgreement)
            .where(eq(agreementContractInReadmodelAgreement.id, contract.id))
        )[0]?.metadataVersion;

        if (
          !existingMetadataVersion ||
          existingMetadataVersion <= metadataVersion
        ) {
          await tx
            .delete(agreementContractInReadmodelAgreement)
            .where(
              and(eq(agreementContractInReadmodelAgreement.id, contract.id))
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
        }
      });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
