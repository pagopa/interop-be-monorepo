/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementConsumerDocumentSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable, DeletingDbTable } from "../../model/db.js";
import { agreementConsumerDocumentSchema } from "../../model/agreement/agreementConsumerDocument.js";
import { agreementDeletingSchema } from "../../model/agreement/agreement.js";

export function agreementConsumerDocumentRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = AgreementDbTable.agreement_consumer_document;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;
  const stagingDeletingTable = DeletingDbTable.agreement_deleting_table;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementConsumerDocumentSQL[]
    ) {
      const mapping = {
        id: (r: AgreementConsumerDocumentSQL) => r.id,
        agreement_id: (r: AgreementConsumerDocumentSQL) => r.agreementId,
        metadata_version: (r: AgreementConsumerDocumentSQL) =>
          r.metadataVersion,
        name: (r: AgreementConsumerDocumentSQL) => r.name,
        pretty_name: (r: AgreementConsumerDocumentSQL) => r.prettyName,
        content_type: (r: AgreementConsumerDocumentSQL) => r.contentType,
        path: (r: AgreementConsumerDocumentSQL) => r.path,
        created_at: (r: AgreementConsumerDocumentSQL) => r.createdAt,
      };
      const cs = buildColumnSet<AgreementConsumerDocumentSQL>(
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
            WHERE a.id = b.id AND a.metadata_version < b.metadata_version;
          `);
        }
      } catch (e) {
        throw genericInternalError(`stage docs: ${e}`);
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            agreementConsumerDocumentSchema,
            schemaName,
            tableName,
            stagingTable,
            "id"
          )
        );
      } catch (e) {
        throw genericInternalError(`merge docs: ${e}`);
      }
    },

    async insertDeletingByAgreementId(
      t: ITask<unknown>,
      pgp: IMain,
      id: string
    ): Promise<void> {
      const mapping = {
        id: () => id,
        deleted: () => true,
      };
      try {
        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          mapping,
          stagingDeletingTable
        );

        await t.none(
          pgp.helpers.insert({ id, deleted: true }, cs) +
            " ON CONFLICT DO NOTHING"
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },

    async mergeDeleting() {
      try {
        const mergeQuery = generateMergeQuery(
          agreementDeletingSchema,
          schemaName,
          tableName,
          stagingDeletingTable,
          "id"
        );
        await conn.none(mergeQuery);
      } catch (error) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (e) {
        throw genericInternalError(`clean doc stage: ${e}`);
      }
    },

    async cleanDeleting() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingDeletingTable};`);
      } catch (error) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingDeletingTable}: ${error}`
        );
      }
    },
  };
}
export type AgreementConsumerDocumentRepo = ReturnType<
  typeof agreementConsumerDocumentRepo
>;
