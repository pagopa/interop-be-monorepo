/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateVersionInterfaceSchema } from "../../model/eserviceTemplate/eserviceTemplateVersionInterface.js";

export const eserviceTemplateVersionInterfaceRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_version_interface,
    schema: EserviceTemplateVersionInterfaceSchema,
    keyColumns: ["id"],
  });
