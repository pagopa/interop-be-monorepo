/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceTemplateVersionInterfaceSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceTemplateVersionInterfaceRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_version_interface,
    schema: EserviceTemplateVersionInterfaceSchema,
    keyColumns: ["id"],
  });
