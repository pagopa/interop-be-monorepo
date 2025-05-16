/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementStampSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db.js";
import { AgreementStampSchema } from "../../model/agreement/agreementStamp.js";

export function agreementStampRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = AgreementDbTable.agreement_stamp;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(t: ITask<unknown>, pgp: IMain, records: AgreementStampSQL[]) {
      const mapping = {
        agreement_id: (r: AgreementStampSQL) => r.agreementId,
        metadata_version: (r: AgreementStampSQL) => r.metadataVersion,
        who: (r: AgreementStampSQL) => r.who,
        delegation_id: (r: AgreementStampSQL) => r.delegationId,
        when: (r: AgreementStampSQL) => r.when,
        kind: (r: AgreementStampSQL) => r.kind,
      };
      const cs = buildColumnSet<AgreementStampSQL>(pgp, mapping, stagingTable);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
            DELETE FROM ${stagingTable} a
            USING ${stagingTable} b
            WHERE a.agreement_id = b.agreement_id AND a.kind = b.kind
              AND a.kind = b.kind
              AND a.metadata_version < b.metadata_version;
          `);
        }
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            AgreementStampSchema,
            schemaName,
            tableName,
            stagingTable,
            ["agreement_id", "kind"]
          )
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTable} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean() {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTable};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTable}: ${error}`
        );
      }
    },
  };
}
export type AgreementStampRepo = ReturnType<typeof agreementStampRepo>;
