/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericInternalError } from "pagopa-interop-models";
import { ITask } from "pg-promise";
import { DBConnection } from "../../db/db.js";
import { generateMergeDeleteQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import {
  EserviceDescriptorDocumentOrInterfaceDeletingSchema,
  EserviceDescriptorInterfaceSchema,
} from "../../model/catalog/eserviceDescriptorInterface.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export function eserviceDescriptorInterfaceRepository(conn: DBConnection) {
  const base = createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_interface,
    schema: EserviceDescriptorInterfaceSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName:
        DeletingDbTable.catalog_descriptor_interface_deleting_table,
      deletingSchema: EserviceDescriptorDocumentOrInterfaceDeletingSchema,
    },
  });

  const schemaName = config.dbSchemaName;
  const tableName = CatalogDbTable.eservice_descriptor_interface;
  const deletingTableName =
    DeletingDbTable.catalog_descriptor_interface_deleting_table;
  const stagingDeletingTableName = `${deletingTableName}_${config.mergeTableSuffix}`;

  return {
    ...base,

    // Custom mergeDeleting: returns the IDs that existed in the target table before deletion
    async mergeDeleting(
      t: ITask<unknown>,
      idsToDelete: string[]
    ): Promise<string[]> {
      try {
        const idParams = idsToDelete.map((_, i) => `$${i + 1}`).join(", ");

        const existingIds = await t.map<string>(
          `SELECT id
          FROM ${schemaName}.${tableName}
          WHERE id IN (${idParams})`,
          idsToDelete,
          (row) => row.id
        );

        const mergeQuery = generateMergeDeleteQuery(
          schemaName,
          tableName,
          deletingTableName,
          ["id"]
        );
        await t.none(mergeQuery);

        return existingIds;
      } catch (error: unknown) {
        throw genericInternalError(
          `Error merging staging table ${stagingDeletingTableName} into ${schemaName}.${tableName}: ${error}`
        );
      }
    },
  };
}
