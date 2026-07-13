/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceDescriptorArchivingSchema } from "pagopa-interop-kpi-models";
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";

export const eserviceDescriptorArchivingRepository = (conn: DBConnection) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_archiving_schedule,
    schema: EserviceDescriptorArchivingSchema,
    keyColumns: ["descriptorId", "eserviceId"],
  });
