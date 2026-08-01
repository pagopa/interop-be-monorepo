/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { PurposeTemplateEserviceTemplateVersionSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import {
  DeletingDbTable,
  PurposeTemplateDbTable,
} from "../../model/db/index.js";
import { PurposeTemplateEserviceTemplateVersionDeletingSchema } from "../../model/purposeTemplate/purposeTemplateEserviceTemplateVersion.js";
import { createRepository } from "../createRepository.js";

export const purposeTemplateEserviceTemplateVersionRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName:
      PurposeTemplateDbTable.purpose_template_eservice_template_version,
    schema: PurposeTemplateEserviceTemplateVersionSchema,
    keyColumns: ["purposeTemplateId", "eserviceTemplateId"],
    deleting: {
      deletingTableName:
        DeletingDbTable.purpose_template_eservice_template_version_deleting_table,
      deletingSchema: PurposeTemplateEserviceTemplateVersionDeletingSchema,
      deletingKeyColumns: [
        "purposeTemplateId",
        "eserviceTemplateId",
        "eserviceTemplateVersionId",
      ],
      useIdAsSourceDeleteKey: false,
      physicalDelete: false,
    },
  });
