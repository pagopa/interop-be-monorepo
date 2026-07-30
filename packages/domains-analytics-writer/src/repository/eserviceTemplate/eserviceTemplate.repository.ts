/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceTemplateSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import {
  EserviceTemplateDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import { EserviceTemplateDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplate.js";
import { createRepository } from "../createRepository.js";

export const eserviceTemplateRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template,
    schema: EserviceTemplateSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.eservice_template_deleting_table,
      deletingSchema: EserviceTemplateDeletingSchema,
      physicalDelete: false,
    },
  });
