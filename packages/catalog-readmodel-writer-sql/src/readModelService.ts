import {
  Descriptor,
  DescriptorId,
  Document,
  EService,
  EServiceDocumentId,
  EServiceId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  CatalogReadModelService,
  documentToDocumentSQL,
  splitDescriptorIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: ReturnType<typeof drizzle>,
  catalogReadModelService: CatalogReadModelService
) {
  return {
    async upsertEService(eservice: WithMetadata<EService>): Promise<void> {
      return await catalogReadModelService.upsertEService(eservice);
    },
    async deleteDescriptor({
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
              eq(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceId),
              lte(
                eserviceDescriptorInReadmodelCatalog.metadataVersion,
                metadataVersion
              )
            )
          );

        await updateESserviceVersionInEServiceTable(
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
      const documentSQL = documentToDocumentSQL(
        document,
        descriptorId,
        eserviceId,
        metadataVersion
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(eserviceDescriptorDocumentInReadmodelCatalog)
          .where(
            and(
              eq(
                eserviceDescriptorDocumentInReadmodelCatalog.eserviceId,
                eserviceId
              ),
              eq(
                eserviceDescriptorDocumentInReadmodelCatalog.descriptorId,
                descriptorId
              ),
              eq(eserviceDescriptorDocumentInReadmodelCatalog.id, document.id),
              lte(
                eserviceDescriptorDocumentInReadmodelCatalog.metadataVersion,
                metadataVersion
              )
            )
          );

        await tx
          .insert(eserviceDescriptorDocumentInReadmodelCatalog)
          .values(documentSQL);

        await updateESserviceVersionInEServiceTable(
          tx,
          eserviceId,
          metadataVersion
        );
      });
    },

    async upsertInterface({
      eserviceId,
      descriptorId,
      descriptorInterface,
      metadataVersion,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      descriptorInterface: Document;
      metadataVersion: number;
    }): Promise<void> {
      const interfaceSQL = documentToDocumentSQL(
        descriptorInterface,
        descriptorId,
        eserviceId,
        metadataVersion
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(eserviceDescriptorInterfaceInReadmodelCatalog)
          .where(
            and(
              eq(
                eserviceDescriptorInterfaceInReadmodelCatalog.id,
                descriptorInterface.id
              ),
              eq(
                eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId,
                descriptorId
              ),
              eq(
                eserviceDescriptorInterfaceInReadmodelCatalog.eserviceId,
                eserviceId
              ),
              lte(
                eserviceDescriptorInterfaceInReadmodelCatalog.metadataVersion,
                metadataVersion
              )
            )
          );
        await tx
          .insert(eserviceDescriptorInterfaceInReadmodelCatalog)
          .values(interfaceSQL);

        // TODO serverUrls

        await updateESserviceVersionInEServiceTable(
          tx,
          eserviceId,
          metadataVersion
        );
      });
    },

    async deleteEService(
      eserviceId: EServiceId,
      metadataVersion: number
    ): Promise<void> {
      return catalogReadModelService.deleteEServiceById(
        eserviceId,
        metadataVersion
      );
    },

    async deleteDocument({
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
          // TODO tests if serverUrls is actually set to undefined
          await tx
            .update(eserviceDescriptorInReadmodelCatalog)
            .set({ serverUrls: undefined })
            .where(
              and(
                eq(eserviceDescriptorInReadmodelCatalog.id, descriptorId),
                lte(
                  eserviceDescriptorInReadmodelCatalog.metadataVersion,
                  metadataVersion
                )
              )
            );
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

        await updateESserviceVersionInEServiceTable(
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

      await db.transaction(async (tx) => {
        await tx
          .delete(eserviceDescriptorInReadmodelCatalog)
          .where(
            and(
              eq(eserviceDescriptorInReadmodelCatalog.id, descriptor.id),
              eq(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceId),
              lte(eserviceInReadmodelCatalog.metadataVersion, metadataVersion)
            )
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

        await updateESserviceVersionInEServiceTable(
          tx,
          eserviceId,
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

const updateESserviceVersionInEServiceTable = async (
  tx: TransactionType,
  eserviceId: EServiceId,
  newVersion: number
): Promise<void> => {
  await tx
    .update(eserviceInReadmodelCatalog)
    .set({ metadataVersion: newVersion })
    .where(
      and(
        eq(eserviceInReadmodelCatalog.id, eserviceId),
        lte(eserviceInReadmodelCatalog.metadataVersion, newVersion)
      )
    );
};

export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
