/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AttributeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { AttributeDeletingSchema } from "../../model/attribute/attribute.js";
import { AttributeDbTable, DeletingDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

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
