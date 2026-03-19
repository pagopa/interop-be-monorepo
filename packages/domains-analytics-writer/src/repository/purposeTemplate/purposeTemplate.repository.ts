/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import {
  PurposeTemplateDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import {
  PurposeTemplateSchema,
  PurposeTemplateDeletingSchema,
} from "../../model/purposeTemplate/purposeTemplate.js";

export const purposeTemplateRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: PurposeTemplateDbTable.purpose_template,
    schema: PurposeTemplateSchema,
    keyColumns: ["id"],
    deleting: {
      deletingTableName: DeletingDbTable.purpose_template_deleting_table,
      deletingSchema: PurposeTemplateDeletingSchema,
      physicalDelete: false,
    },
  });
