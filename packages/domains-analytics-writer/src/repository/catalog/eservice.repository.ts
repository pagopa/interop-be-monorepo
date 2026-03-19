/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  EserviceSchema,
  EserviceDeletingSchema,
} from "../../model/catalog/eservice.js";

export const eserviceRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice,
    schema: EserviceSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.catalog_deleting_table,
      deletingSchema: EserviceDeletingSchema,
      useIdAsSourceDeleteKey: false,
      physicalDelete: false,
    },
  });
