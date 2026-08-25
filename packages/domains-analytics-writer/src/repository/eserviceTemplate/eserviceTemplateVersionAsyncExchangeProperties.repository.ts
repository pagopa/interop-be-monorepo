/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EserviceTemplateVersionAsyncExchangePropertiesSchema } from "pagopa-interop-kpi-models";

import { DBConnection } from "../../db/db.js";
import { EserviceTemplateDbTable } from "../../model/db/index.js";
import { createRepository } from "../createRepository.js";

export const eserviceTemplateVersionAsyncExchangePropertiesRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName:
      EserviceTemplateDbTable.eservice_template_version_async_exchange_properties,
    schema: EserviceTemplateVersionAsyncExchangePropertiesSchema,
    keyColumns: ["versionId"],
  });
