/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { AttributeDbTable, DeletingDbTable } from "../../model/db/index.js";
import {
  AttributeSchema,
  AttributeDeletingSchema,
} from "../../model/attribute/attribute.js";

export const attributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: AttributeDbTable.attribute,
    schema: AttributeSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.attribute_deleting_table,
      deletingSchema: AttributeDeletingSchema,
      physicalDelete: false,
    },
  });
