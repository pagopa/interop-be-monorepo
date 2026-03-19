/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "../../model/catalog/eserviceDescriptorTemplateVersionRef.js";

export const eserviceDescriptorTemplateVersionRefRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_template_version_ref,
    schema: EserviceDescriptorTemplateVersionRefSchema,
    keyColumns: ["descriptorId", "eserviceTemplateVersionId"],
  });
