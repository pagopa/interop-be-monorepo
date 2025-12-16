import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { EService, Tenant, Attribute } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { z } from "zod";
import {
  upsertAttribute,
  upsertEService,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import {
  attributeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { PublicEService } from "../src/models/models.js";
import { dtdCatalogExporterServiceBuilder } from "../src/services/dtdCatalogExporterService.js";
import { config } from "../src/config/config.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, fileManager, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    inject("fileManagerConfig"),
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const attributeReadModelService = attributeReadModelServiceBuilder(readModelDB);
const tenantReadModelService = tenantReadModelServiceBuilder(readModelDB);
const readModelService = readModelServiceBuilderSQL(
  readModelDB,
  attributeReadModelService,
  tenantReadModelService
);

export const dtdCatalogExporterService = dtdCatalogExporterServiceBuilder({
  readModelService,
  fileManager,
  loggerInstance: genericLogger,
});

export const getExportedDtdPublicCatalogFromJson = async (): Promise<
  PublicEService[]
> => {
  const data = await fileManager.get(
    config.s3Bucket,
    `${config.dtdCatalogStoragePath}/${config.dtdCatalogJsonFilename}`,
    genericLogger
  );

  return z
    .array(PublicEService)
    .parse(JSON.parse(Buffer.from(data).toString()));
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};
