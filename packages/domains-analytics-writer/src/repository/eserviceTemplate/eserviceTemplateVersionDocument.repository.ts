/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { EserviceTemplateVersionDocumentSchema } from "../../model/eserviceTemplate/eserviceTemplateVersionDocument.js";

export const eserviceTemplateVersionDocumentRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: EserviceTemplateDbTable.eservice_template_version_document,
    schema: EserviceTemplateVersionDocumentSchema,
    keyColumns: ["id"],
  });
