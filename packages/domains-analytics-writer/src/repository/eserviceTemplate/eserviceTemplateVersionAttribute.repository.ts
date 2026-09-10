/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceTemplateVersionAttributeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceTemplateVersionAttributeRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_version_attribute,
    schema: EserviceTemplateVersionAttributeSchema,
    keyColumns: ["attributeId", "versionId", "groupId"],
  });
