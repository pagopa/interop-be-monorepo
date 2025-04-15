import {
  Descriptor,
  DescriptorId,
  Document,
  EService,
  EServiceDocumentId,
  EServiceId,
} from "pagopa-interop-models";
import {
  CatalogReadModelService,
  checkMetadataVersion,
  documentToDocumentSQL,
  splitDescriptorIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: DrizzleReturnType,
  catalogReadModelService: CatalogReadModelService
) {
  const updateMetadataVersionInCatalogTables = async (
    tx: DrizzleTransactionType,
    eserviceId: EServiceId,
    newMetadataVersion: number
  ): Promise<void> => {
    const catalogTables = [
      eserviceInReadmodelCatalog,
      eserviceDescriptorInReadmodelCatalog,
      eserviceDescriptorRejectionReasonInReadmodelCatalog,
      eserviceDescriptorInterfaceInReadmodelCatalog,
      eserviceDescriptorDocumentInReadmodelCatalog,
      eserviceDescriptorAttributeInReadmodelCatalog,
      eserviceRiskAnalysisInReadmodelCatalog,
      eserviceRiskAnalysisAnswerInReadmodelCatalog,
    ];

    for (const table of catalogTables) {
      await tx
        .update(table)
        .set({ metadataVersion: newMetadataVersion })
        .where(
          and(
            eq("eserviceId" in table ? table.eserviceId : table.id, eserviceId),
            lte(table.metadataVersion, newMetadataVersion)
          )
        );
    }
  };

  const setServerUrls = async ({
    tx,
    serverUrls,
    descriptorId,
    metadataVersion,
  }: {
    tx: DrizzleTransactionType;
    serverUrls: string[];
    descriptorId: DescriptorId;
    metadataVersion: number;
  }): Promise<void> => {
    await tx
      .update(eserviceDescriptorInReadmodelCatalog)
      .set({ serverUrls })
      .where(
        and(
          eq(eserviceDescriptorInReadmodelCatalog.id, descriptorId),
          lte(
            eserviceDescriptorInReadmodelCatalog.metadataVersion,
            metadataVersion
          )
        )
      );
  };

  return {
    async upsertEService(
      eservice: EService,
      metadataVersion: number
    ): Promise<void> {
      return await catalogReadModelService.upsertEService(
        eservice,
        metadataVersion
      );
    },

    async deleteDescriptorById({
      eserviceId,
      descriptorId,
      metadataVersion,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      metadataVersion: number;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(eserviceDescriptorInReadmodelCatalog)
          .where(
            and(
              eq(eserviceDescriptorInReadmodelCatalog.id, descriptorId),
              lte(
                eserviceDescriptorInReadmodelCatalog.metadataVersion,
                metadataVersion
              )
            )
          );

        await updateMetadataVersionInCatalogTables(
          tx,
          eserviceId,
          metadataVersion
        );
      });
    },

    async upsertDocument({
      eserviceId,
      descriptorId,
      document,
      metadataVersion,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      document: Document;
      metadataVersion: number;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          eserviceDescriptorDocumentInReadmodelCatalog,
          metadataVersion,
          document.id
        );

        if (shouldUpsert) {
          await tx
            .delete(eserviceDescriptorDocumentInReadmodelCatalog)
            .where(
              eq(eserviceDescriptorDocumentInReadmodelCatalog.id, document.id)
            );

          const documentSQL = documentToDocumentSQL(
            document,
            descriptorId,
            eserviceId,
            metadataVersion
          );

          await tx
            .insert(eserviceDescriptorDocumentInReadmodelCatalog)
            .values(documentSQL);

          await updateMetadataVersionInCatalogTables(
            tx,
            eserviceId,
            metadataVersion
          );
        }
      });
    },

    async upsertInterface({
      eserviceId,
      descriptorId,
      descriptorInterface,
      metadataVersion,
      serverUrls,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      descriptorInterface: Document;
      serverUrls: string[];
      metadataVersion: number;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          eserviceDescriptorInterfaceInReadmodelCatalog,
          metadataVersion,
          descriptorInterface.id
        );

        if (shouldUpsert) {
          await tx
            .delete(eserviceDescriptorInterfaceInReadmodelCatalog)
            .where(
              eq(
                eserviceDescriptorInterfaceInReadmodelCatalog.id,
                descriptorInterface.id
              )
            );

          const interfaceSQL = documentToDocumentSQL(
            descriptorInterface,
            descriptorId,
            eserviceId,
            metadataVersion
          );

          await tx
            .insert(eserviceDescriptorInterfaceInReadmodelCatalog)
            .values(interfaceSQL);
          await setServerUrls({
            tx,
            descriptorId,
            serverUrls,
            metadataVersion,
          });

          await updateMetadataVersionInCatalogTables(
            tx,
            eserviceId,
            metadataVersion
          );
        }
      });
    },

    async deleteEServiceById(
      eserviceId: EServiceId,
      metadataVersion: number
    ): Promise<void> {
      return catalogReadModelService.deleteEServiceById(
        eserviceId,
        metadataVersion
      );
    },

    async deleteDocumentOrInterface({
      eserviceId,
      descriptorId,
      documentId,
      metadataVersion,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      documentId: EServiceDocumentId;
      metadataVersion: number;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        const interfaceDeletion = await tx
          .delete(eserviceDescriptorInterfaceInReadmodelCatalog)
          .where(
            and(
              eq(eserviceDescriptorInterfaceInReadmodelCatalog.id, documentId),
              lte(
                eserviceDescriptorInterfaceInReadmodelCatalog.metadataVersion,
                metadataVersion
              )
            )
          );

        if (interfaceDeletion.rowCount === 1) {
          await setServerUrls({
            tx,
            descriptorId,
            serverUrls: [],
            metadataVersion,
          });
        } else {
          await tx
            .delete(eserviceDescriptorDocumentInReadmodelCatalog)
            .where(
              and(
                eq(eserviceDescriptorDocumentInReadmodelCatalog.id, documentId),
                lte(
                  eserviceDescriptorDocumentInReadmodelCatalog.metadataVersion,
                  metadataVersion
                )
              )
            );
        }

        await updateMetadataVersionInCatalogTables(
          tx,
          eserviceId,
          metadataVersion
        );
      });
    },

    async upsertDescriptor({
      eserviceId,
      descriptor,
      metadataVersion,
    }: {
      eserviceId: EServiceId;
      descriptor: Descriptor;
      metadataVersion: number;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          eserviceDescriptorInReadmodelCatalog,
          metadataVersion,
          descriptor.id
        );

        if (shouldUpsert) {
          await tx
            .delete(eserviceDescriptorInReadmodelCatalog)
            .where(eq(eserviceDescriptorInReadmodelCatalog.id, descriptor.id));

          const {
            descriptorSQL,
            attributesSQL,
            interfaceSQL,
            documentsSQL,
            rejectionReasonsSQL,
          } = splitDescriptorIntoObjectsSQL(
            eserviceId,
            descriptor,
            metadataVersion
          );

          await tx
            .insert(eserviceDescriptorInReadmodelCatalog)
            .values(descriptorSQL);

          if (interfaceSQL) {
            await tx
              .insert(eserviceDescriptorInterfaceInReadmodelCatalog)
              .values(interfaceSQL);
          }

          for (const docSQL of documentsSQL) {
            await tx
              .insert(eserviceDescriptorDocumentInReadmodelCatalog)
              .values(docSQL);
          }

          for (const attributeSQL of attributesSQL) {
            await tx
              .insert(eserviceDescriptorAttributeInReadmodelCatalog)
              .values(attributeSQL);
          }

          for (const rejectionReasonSQL of rejectionReasonsSQL) {
            await tx
              .insert(eserviceDescriptorRejectionReasonInReadmodelCatalog)
              .values(rejectionReasonSQL);
          }

          await updateMetadataVersionInCatalogTables(
            tx,
            eserviceId,
            metadataVersion
          );
        }
      });
    },
  };
}

export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
