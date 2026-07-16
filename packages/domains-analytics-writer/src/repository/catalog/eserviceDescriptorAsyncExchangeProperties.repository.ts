/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceDescriptorAsyncExchangePropertiesSchema } from "pagopa-interop-kpi-models";
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import { CatalogDbTable } from "../../model/db/index.js";

export const eserviceDescriptorAsyncExchangePropertiesRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: CatalogDbTable.eservice_descriptor_async_exchange_properties,
    schema: EserviceDescriptorAsyncExchangePropertiesSchema,
    keyColumns: ["descriptorId"],
  });
