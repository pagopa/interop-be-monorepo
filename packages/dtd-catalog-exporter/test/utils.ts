import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  EService,
  Tenant,
  toReadModelEService,
  toReadModelTenant,
  Attribute,
  toReadModelAttribute,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { z } from "zod";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { dtdCatalogExporterServiceBuilder } from "../src/services/dtdCatalogExporterService.js";
import { config } from "../src/config/config.js";
import { PublicEService } from "../src/models/models.js";

export const {
  cleanup,
  readModelRepository,
  postgresDB: _,
  fileManager,
} = await setupTestContainersVitest(
  inject("readModelConfig"),
  undefined,
  inject("fileManagerConfig")
);

afterEach(cleanup);

const eservices = readModelRepository.eservices;
const tenants = readModelRepository.tenants;
const attributes = readModelRepository.attributes;

const readModelService = readModelServiceBuilder(readModelRepository);

export const dtdCatalogExporterService = dtdCatalogExporterServiceBuilder({
  readModelService,
  fileManager,
  loggerInstance: genericLogger,
});

export const getExportDtdPublicCatalogResult = async (): Promise<
  PublicEService[]
> => {
  const data = await fileManager.get(
    config.s3Bucket,
    `${config.dtdCatalogStoragePath}/${config.dtdCatalogFilename}`,
    genericLogger
  );

  return z
    .array(PublicEService)
    .parse(JSON.parse(Buffer.from(data).toString()));
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};
