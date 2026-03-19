/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";
import { EserviceDescriptorRejectionReasonSchema } from "pagopa-interop-kpi-models";

export const eserviceDescriptorRejectionRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_rejection_reason,
    schema: EserviceDescriptorRejectionReasonSchema,
    keyColumns: ["descriptorId"],
  });
