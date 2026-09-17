/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceDescriptorRejectionReasonSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceDescriptorRejectionRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_rejection_reason,
    schema: EserviceDescriptorRejectionReasonSchema,
    keyColumns: ["descriptorId"],
  });
