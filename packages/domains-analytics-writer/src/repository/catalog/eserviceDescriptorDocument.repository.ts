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
  EserviceDescriptorDocumentDeletingMapping,
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
        id: (r) => r.id,
        eserviceId: (r) => r.eserviceId,
        metadataVersion: (r) => r.metadataVersion,
        descriptorId: (r) => r.descriptorId,
        name: (r) => r.name,
        contentType: (r) => r.contentType,
        prettyName: (r) => r.prettyName,
        path: (r) => r.path,
        checksum: (r) => r.checksum,
        uploadDate: (r) => r.uploadDate,
      };
      const cs = buildColumnSet(pgp, mapping, tableName);
      try {
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.id = b.id
          AND a.metadata_version < b.metadata_version;
        `);
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
        const mapping: EserviceDescriptorDocumentDeletingMapping = {
          id: (r) => r.id,
          deleted: () => true,
        };
        const cs = buildColumnSet(pgp, mapping, stagingDeletingTable);
        const records = recordsId.map((id) => ({ id }));

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
        await conn.none(
          `TRUNCATE TABLE ${stagingDeletingTable}_${config.mergeTableSuffix};`
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorDocumentRepository = ReturnType<
  typeof eserviceDescriptorDocumentRepository
>;
