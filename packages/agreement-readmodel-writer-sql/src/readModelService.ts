import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  agreementDocumentToAgreementDocumentSQL,
} from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, lte } from "drizzle-orm";
import {
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
} from "../../readmodel-models/dist/drizzle/schema.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  db: ReturnType<typeof drizzle>,
  agreementReadModelService: AgreementReadModelService
) {
  return {
    async upsertAgreement(agreement: WithMetadata<Agreement>): Promise<void> {
      return await agreementReadModelService.upsertAgreement(agreement);
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
        await updateMetadataVersionInAgreementTable(
          tx,
          agreementId,
          metadataVersion
        );
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
      });
    },

    async deleteConsumerDocument(
      agreementId: AgreementId,
      consumerDocumentId: AgreementDocumentId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await updateMetadataVersionInAgreementTable(
          tx,
          agreementId,
          metadataVersion
        );
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
        await updateMetadataVersionInAgreementTable(
          tx,
          agreementId,
          metadataVersion
        );
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
      });
    },
  };
}

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

const updateMetadataVersionInAgreementTable = async (
  tx: TransactionType,
  agreementId: AgreementId,
  newVersion: number
): Promise<void> => {
  await tx
    .update(agreementInReadmodelAgreement)
    .set({ metadataVersion: newVersion })
    .where(
      and(
        eq(agreementInReadmodelAgreement.id, agreementId),
        lte(agreementInReadmodelAgreement.metadataVersion, newVersion)
      )
    );
};

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
