/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceDescriptorTemplateVersionRefSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceDescriptorTemplateVersionRefRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_template_version_ref,
    schema: EserviceDescriptorTemplateVersionRefSchema,
    keyColumns: ["descriptorId", "eserviceTemplateVersionId"],
  });
