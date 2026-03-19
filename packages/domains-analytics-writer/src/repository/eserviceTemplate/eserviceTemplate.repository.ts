/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import {
  EserviceTemplateDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import { EserviceTemplateSchema } from "pagopa-interop-kpi-models";
import { EserviceTemplateDeletingSchema } from "../../model/eserviceTemplate/eserviceTemplate.js";

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
