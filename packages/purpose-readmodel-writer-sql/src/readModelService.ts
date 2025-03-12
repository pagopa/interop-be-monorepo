import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionId,
} from "pagopa-interop-models";
import {
  PurposeReadModelService,
  splitPurposeVersionIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  purposeInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "../../readmodel-models/dist/index.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>,
  purposeReadModelService: PurposeReadModelService
) {
  const updateMetadataVersionInPurposeTable = async (
    tx: TransactionType,
    purposeId: PurposeId,
    newMetadataVersion: number
  ): Promise<void> => {
    await tx
      .update(purposeInReadmodelPurpose)
      .set({ metadataVersion: newMetadataVersion })
      .where(
        and(
          eq(purposeInReadmodelPurpose.id, purposeId),
          lte(purposeInReadmodelPurpose.metadataVersion, newMetadataVersion)
        )
      );
  };

  return {
    async upsertPurpose(
      purpose: Purpose,
      metadataVersion: number
    ): Promise<void> {
      await purposeReadModelService.upsertPurpose(purpose, metadataVersion);
    },

    async deletePurposeById(
      purposeId: PurposeId,
      version: number
    ): Promise<void> {
      await purposeReadModelService.deletePurposeById(purposeId, version);
    },

    async upsertPurposeVersion(
      purposeId: PurposeId,
      purposeVersion: PurposeVersion,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const { versionSQL, versionDocumentSQL } =
          splitPurposeVersionIntoObjectsSQL(
            purposeId,
            purposeVersion,
            metadataVersion
          );

        await updateMetadataVersionInPurposeTable(
          tx,
          purposeId,
          metadataVersion
        );

        // TODO: add version checking "lte"
        await tx
          .delete(purposeVersionInReadmodelPurpose)
          .where(eq(purposeVersionInReadmodelPurpose.id, purposeVersion.id));

        await tx.insert(purposeVersionInReadmodelPurpose).values(versionSQL);
        if (versionDocumentSQL) {
          await tx
            .insert(purposeVersionDocumentInReadmodelPurpose)
            .values(versionDocumentSQL);
        }
      });
    },

    async deletePurposeVersionById(
      purposeId: PurposeId,
      purposeVersionId: PurposeVersionId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await updateMetadataVersionInPurposeTable(
          tx,
          purposeId,
          metadataVersion
        );

        await tx
          .delete(purposeVersionInReadmodelPurpose)
          .where(
            and(
              eq(purposeVersionInReadmodelPurpose.id, purposeVersionId),
              lte(
                purposeVersionInReadmodelPurpose.metadataVersion,
                metadataVersion
              )
            )
          );
      });
    },
  };
}
export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;

// TODO: import this after merging
export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];
