/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceDeletingSchema } from "../../model/catalog/eservice.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

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
