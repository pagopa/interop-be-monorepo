/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeTemplateSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import {
  PurposeTemplateDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import { PurposeTemplateDeletingSchema } from "../../model/purposeTemplate/purposeTemplate.js";
import { createRepository } from "../createRepository.js";

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
