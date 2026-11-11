/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceDescriptorDocumentSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceDescriptorDocumentDeletingSchema } from "../../model/catalog/eserviceDescriptorDocument.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceDescriptorDocumentRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_document,
    schema: EserviceDescriptorDocumentSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.catalog_deleting_table,
      deletingSchema: EserviceDescriptorDocumentDeletingSchema,
    },
  });
