/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { IMain, ITask } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import {
  buildColumnSet,
  generateMergeQuery,
  generateStagingDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { PurposeTemplateDbTable } from "../../model/db/index.js";
import { PurposeTemplateEServiceDescriptorVersionSchema } from "../../model/purposeTemplate/purposeTemplateEserviceDescriptorVersion.js";

export function purposeTemplateEServiceDescriptorVersionRepository(
  conn: DBConnection
) {
  const schemaName = config.dbSchemaName;
  const tableName =
    PurposeTemplateDbTable.purpose_template_eservice_descriptor_version;
  const stagingTableName = `${tableName}_${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: PurposeTemplateEServiceDescriptorVersionSchema[]
    ): Promise<void> {
      try {
        const cs = buildColumnSet(
          pgp,
          tableName,
          PurposeTemplateEServiceDescriptorVersionSchema
        );
        await t.none(pgp.helpers.insert(records, cs));
        await t.none(
          generateStagingDeleteQuery(tableName, [
            "purposeTemplateId",
            "eserviceId",
          ])
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
          PurposeTemplateEServiceDescriptorVersionSchema,
          schemaName,
          tableName,
          ["purposeTemplateId", "eserviceId"]
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

export type PurposeTemplateEServiceDescriptorVersionRepository = ReturnType<
  typeof purposeTemplateEServiceDescriptorVersionRepository
>;
