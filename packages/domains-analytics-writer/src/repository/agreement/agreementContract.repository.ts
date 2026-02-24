/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db/index.js";
import { AgreementContractSchema } from "../../model/agreement/agreementContract.js";

export function agreementContractRepo(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = AgreementDbTable.agreement_contract;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementContractSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(pgp, tableName, AgreementContractSchema);
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, ["id", "agreementId"])
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTableName}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          AgreementContractSchema,
          schemaName,
          tableName,
          ["id", "agreementId"]
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
