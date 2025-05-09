import { genericInternalError } from "pagopa-interop-models";
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { DBConnection } from "../../db/db.js";
import {
  AttributeMapping,
  AttributeSchema,
} from "../../model/attribute/attribute.js";
import {
  generateMergeDeleteQuery,
  generateMergeQuery,
} from "../../utils/sqlQueryHelper.js";
import { DeletingDbTable, AttributeDbTable } from "../../model/db.js";

/* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */
export function attributeRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = AttributeDbTable.attribute;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;
  const deletingTable = DeletingDbTable.attribute_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AttributeSQL[]
    ): Promise<void> {
      const mapping: AttributeMapping = {
        id: (r: AttributeSQL) => r.id,
        metadata_version: (r: AttributeSQL) => r.metadataVersion,
        code: (r: AttributeSQL) => r.code,
        kind: (r: AttributeSQL) => r.kind,
        description: (r: AttributeSQL) => r.description,
        origin: (r: AttributeSQL) => r.origin,
        name: (r: AttributeSQL) => r.name,
        creation_time: (r: AttributeSQL) => r.creationTime,
      };
      const cs = buildColumnSet<AttributeSQL>(pgp, mapping, stagingTable);
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
          AttributeSchema,
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
      recordsId: Array<AttributeSQL["id"]>
    ): Promise<void> {
      try {
        const mapping = {
          id: (r: { id: string }) => r.id,
          deleted: () => true,
        };
        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          DeletingDbTable.attribute_deleting_table
        );

        const records = recordsId.map((id: string) => ({ id, deleted: true }));

        await t.none(
          pgp.helpers.insert(records, cs) + " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into deleting table ${DeletingDbTable.attribute_deleting_table}: ${error}`
        );
      }
    },

    async mergeDeleting(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTable,
          ["id"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging deletion flag from ${deletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async cleanDeleting(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${deletingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning deleting table ${deletingTable}: ${error}`
        );
      }
    },
  };
}
