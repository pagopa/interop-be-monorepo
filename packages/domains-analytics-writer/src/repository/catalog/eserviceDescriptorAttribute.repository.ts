/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { EserviceDescriptorAttributeSchema } from "../../model/catalog/eserviceDescriptorAttribute.js";

export const eserviceDescriptorAttributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_attribute,
    schema: EserviceDescriptorAttributeSchema,
    keyColumns: ["attributeId", "groupId", "descriptorId"],
  });
