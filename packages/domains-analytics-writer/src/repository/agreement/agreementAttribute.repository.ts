/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { AgreementAttributeSchema } from "../../model/agreement/agreementAttribute.js";

export function agreementAttributeRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = AgreementDbTable.agreement_attribute;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementAttributeSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, AgreementAttributeSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(`
          DELETE FROM ${stagingTableName} a
          USING ${stagingTableName} b
          WHERE a.agreement_id = b.agreement_id 
            AND a.attribute_id = b.attribute_id
            AND a.metadata_version < b.metadata_version;
        `);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          AgreementAttributeSchema,
          schemaName,
          tableName,
          ["agreementId", "attributeId"]
        );
        await t.none(mergeQuery);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },

    async clean(): Promise<void> {
      try {
        await conn.none(`TRUNCATE TABLE ${stagingTableName};`);
      } catch (error: unknown) {
        throw genericInternalError(
          `Error cleaning staging table ${stagingTableName}: ${error}`
        );
      }
    },
  };
}

export type AgreementAttributeRepo = ReturnType<typeof agreementAttributeRepo>;
