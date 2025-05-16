/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericInternalError } from "pagopa-interop-models";
import { PurposeVersionDocumentSQL } from "pagopa-interop-readmodel-models";
import { ITask, IMain } from "pg-promise";
import { config } from "../../config/config.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { DBContext } from "../../db/db.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { PurposeVersionDocumentSchema } from "../../model/purpose/purposeVersionDocument.js";
import { PurposeDbTable } from "../../model/db.js";

export function purposeVersionDocumentRepository(conn: DBContext["conn"]) {
  const schemaName = config.dbSchemaName;
  const tableName = PurposeDbTable.purpose_version_document;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeVersionDocumentSQL[]
    ) {
      const mapping = {
        purpose_id: (r: PurposeVersionDocumentSQL) => r.purposeId,
        metadata_version: (r: PurposeVersionDocumentSQL) => r.metadataVersion,
        purpose_version_id: (r: PurposeVersionDocumentSQL) =>
          r.purposeVersionId,
        id: (r: PurposeVersionDocumentSQL) => r.id,
        content_type: (r: PurposeVersionDocumentSQL) => r.contentType,
        path: (r: PurposeVersionDocumentSQL) => r.path,
        created_at: (r: PurposeVersionDocumentSQL) => r.createdAt,
      };
      const cs = buildColumnSet<PurposeVersionDocumentSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
          DELETE FROM ${stagingTable} a
          USING ${stagingTable} b
          WHERE a.id = b.id
          AND a.purpose_version_id = b.purpose_version_id
          AND a.metadata_version < b.metadata_version;
        `);
        }
      } catch (error) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            PurposeVersionDocumentSchema,
            schemaName,
            tableName,
            stagingTable,
            ["id", "purpose_version_id"]
          )
        );
      } catch (error) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`
        );
      }
    },
  };
}
