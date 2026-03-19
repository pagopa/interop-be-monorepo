/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable, DeletingDbTable } from "../../model/db/index.js";
import { EserviceDescriptorDocumentSchema } from "pagopa-interop-kpi-models";
import { EserviceDescriptorDocumentDeletingSchema } from "../../model/catalog/eserviceDescriptorDocument.js";

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
