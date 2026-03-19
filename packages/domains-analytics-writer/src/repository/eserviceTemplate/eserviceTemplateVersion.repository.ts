/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateVersionSchema } from "../../model/eserviceTemplate/eserviceTemplateVersion.js";

export const eserviceTemplateVersionRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_version,
    schema: EserviceTemplateVersionSchema,
    keyColumns: ["id"],
  });
