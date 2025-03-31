/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { z } from "zod";
import { EServiceSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";

const eserviceSchema = z.object({
  // todo export and type mapping
  id: z.string(),
  metadata_version: z.number(),
  name: z.string(),
  created_at: z.string(),
  producer_id: z.string(),
  description: z.string(),
  technology: z.string(),
  mode: z.string(),
  is_signal_hub_enabled: z.string().nullable(),
  is_consumer_delegable: z.string().nullable(),
  is_client_access_delegable: z.string().nullable(),
});

export function eserviceRepository(conn: DBConnection) {
  const schemaName = "domains_catalog";
  const tableName = "eservice";
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceSQL
    ): Promise<void> {
      const mapping = {
        id: (r: EServiceSQL) => r.id,
        metadata_version: (r: EServiceSQL) => r.metadataVersion,
        name: (r: EServiceSQL) => r.name,
        producer_id: (r: EServiceSQL) => r.producerId,
        created_at: (r: EServiceSQL) => r.createdAt,
        description: (r: EServiceSQL) => r.description,
        technology: (r: EServiceSQL) => r.technology,
        mode: (r: EServiceSQL) => r.mode,
        is_signal_hub_enabled: (r: EServiceSQL) =>
          r.isSignalHubEnabled ? "true" : "false",
        is_consumer_delegable: (r: EServiceSQL) =>
          r.isConsumerDelegable ? "true" : "false",
        is_client_access_delegable: (r: EServiceSQL) =>
          r.isClientAccessDelegable ? "true" : "false",
      };
      const cs = buildColumnSet<EServiceSQL>(pgp, mapping, stagingTable);
      try {
        await t.none(pgp.helpers.insert(records, cs));
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceSchema,
          schemaName,
          tableName,
          config.mergeTableSuffix,
          "id"
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
  };
}

export type EserviceRepository = ReturnType<typeof eserviceRepository>;
