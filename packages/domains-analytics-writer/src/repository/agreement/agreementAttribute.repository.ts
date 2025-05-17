/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementAttributeSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db.js";
import { AgreementAttributeSchema } from "../../model/agreement/agreementAttribute.js";

export function agreementAttributeRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = AgreementDbTable.agreement_attribute;
  const stagingTable = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementAttributeSQL[]
    ) {
      const mapping = {
        agreement_id: (r: AgreementAttributeSQL) => r.agreementId,
        metadata_version: (r: AgreementAttributeSQL) => r.metadataVersion,
        attribute_id: (r: AgreementAttributeSQL) => r.attributeId,
        kind: (r: AgreementAttributeSQL) => r.kind,
      };
      const cs = buildColumnSet<AgreementAttributeSQL>(
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
            WHERE a.agreement_id = b.agreement_id 
            AND a.attribute_id = b.attribute_id
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
            AgreementAttributeSchema,
            schemaName,
            tableName,
            stagingTable,
            ["agreement_id", "attribute_id"]
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
export type AgreementAttributeRepo = ReturnType<typeof agreementAttributeRepo>;
