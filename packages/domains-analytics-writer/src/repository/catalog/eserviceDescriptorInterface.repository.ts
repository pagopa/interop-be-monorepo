/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { EServiceDescriptorInterfaceSQL } from "pagopa-interop-readmodel-models";
import { DBConnection, IMain, ITask } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorInterfaceMapping,
  eserviceDescriptorInterfaceSchema,
} from "../../model/catalog/eserviceDescriptorInterface.js";
import { CatalogDbTable } from "../../model/db.js";

export function eserviceDescriptorInterfaceRepository(conn: DBConnection) {
  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_interface;
  const stagingTable = `${tableName}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: EServiceDescriptorInterfaceSQL[]
    ): Promise<void> {
      const mapping: EserviceDescriptorInterfaceMapping = {
        id: (r: EServiceDescriptorInterfaceSQL) => r.id,
        eservice_id: (r: EServiceDescriptorInterfaceSQL) => r.eserviceId,
        metadata_version: (r: EServiceDescriptorInterfaceSQL) =>
          r.metadataVersion,
        descriptor_id: (r: EServiceDescriptorInterfaceSQL) => r.descriptorId,
        name: (r: EServiceDescriptorInterfaceSQL) => r.name,
        content_type: (r: EServiceDescriptorInterfaceSQL) => r.contentType,
        pretty_name: (r: EServiceDescriptorInterfaceSQL) => r.prettyName,
        path: (r: EServiceDescriptorInterfaceSQL) => r.path,
        checksum: (r: EServiceDescriptorInterfaceSQL) => r.checksum,
        upload_date: (r: EServiceDescriptorInterfaceSQL) => r.uploadDate,
      };
      const cs = buildColumnSet<EServiceDescriptorInterfaceSQL>(
        pgp,
        mapping,
        stagingTable
      );
      try {
        if (records.length > 0) {
          await t.none(pgp.helpers.insert(records, cs));
        }
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${stagingTable}: ${error}`
        );
      }
    },

    async merge(t: ITask<unknown>): Promise<void> {
      try {
        const mergeQuery = generateMergeQuery(
          eserviceDescriptorInterfaceSchema,
          schemaName,
          tableName,
          `${tableName}${config.mergeTableSuffix}`,
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

    async deleteInterface(
      t: ITask<unknown>,
      pgp: IMain,
      descriptorId: string
    ): Promise<void> {
      const mapping = {
        id: () => descriptorId,
        deleted: () => true,
      };
      const cs = buildColumnSet<{ id: string; deleted: boolean }>(
        pgp,
        mapping,
        CatalogDbTable.deleting_by_id_table
      );
      try {
        await t.none(
          pgp.helpers.insert({ id: descriptorId, deleted: true }, cs)
        );
      } catch (error: unknown) {
        throw genericInternalError(
          `Error inserting into staging table ${CatalogDbTable.deleting_by_id_table}: ${error}`
        );
      }
    },
  };
}

export type EserviceDescriptorInterfaceRepository = ReturnType<
  typeof eserviceDescriptorInterfaceRepository
>;
