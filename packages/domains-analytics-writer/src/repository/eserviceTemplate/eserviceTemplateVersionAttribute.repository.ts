/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateVersionAttributeSchema } from "pagopa-interop-kpi-models";

export const eserviceTemplateVersionAttributeRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_version_attribute,
    schema: EserviceTemplateVersionAttributeSchema,
    keyColumns: ["attributeId", "versionId", "groupId"],
  });
