/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorDocumentSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorDocumentMapping,
  EserviceDescriptorDocumentSchema,
} from "../../model/catalog/eserviceDescriptorDocument.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db.js";

export function eserviceDescriptorDocumentRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_document;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.catalog_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorDocumentSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorDocumentMapping = {
        id: (r: EServiceDescriptorDocumentSQL) => r.id,
        eservice_id: (r: EServiceDescriptorDocumentSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorDocumentSQL) =>
          r.metadataVersion,
        descriptor_id: (r: EServiceDescriptorDocumentSQL) => r.descriptorId,
        name: (r: EServiceDescriptorDocumentSQL) => r.name,
        content_type: (r: EServiceDescriptorDocumentSQL) => r.contentType,
        pretty_name: (r: EServiceDescriptorDocumentSQL) => r.prettyName,
        path: (r: EServiceDescriptorDocumentSQL) => r.path,
        checksum: (r: EServiceDescriptorDocumentSQL) => r.checksum,
        upload_date: (r: EServiceDescriptorDocumentSQL) => r.uploadDate,
      };
      const cs = buildColumnSet<EServiceDescriptorDocumentSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length > 0) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.id = b.id
          AND a.metadata_version < b.metadata_version;
        `);
        }
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          EserviceDescriptorDocumentSchema,
          schemaName,
          tableName,
          stagingTable,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`
        );
      }
    },

    async insertDeleting(
      t: ITask<unknown>,
      pgp: IMain,
      recordsId: Array<EServiceDescriptorDocumentSQL["id"]>
    ): Promise<void> {
      try {
        const mapping = {
          id: (r: { id: string }) => r.id,
          deleted: () => true,
        };
        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          stagingDeletingTable
        );
        const records = recordsId.map((id: string) => ({ id, deleted: true }));

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          stagingDeletingTable,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorDocumentRepository = ReturnType<
  typeof eserviceDescriptorDocumentRepository
>;
