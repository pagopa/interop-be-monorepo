/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceDescriptorAttributeSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceDescriptorAttributeRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_attribute,
    schema: EserviceDescriptorAttributeSchema,
    keyColumns: ["attributeId", "groupId", "descriptorId"],
  });
