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
import { parse } from "csv-parse/sync";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { dtdCatalogExporterServiceBuilder } from "../src/services/dtdCatalogExporterService.js";
import { config } from "../src/config/config.js";
import { PublicEService, PublicTenant } from "../src/models/models.js";

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

export const getExportedDtdPublicCatalogFromCsv = async (): Promise<
  PublicEService[]
> => {
  const data = await fileManager.get(
    config.s3Bucket,
    `${config.dtdCatalogStoragePath}/${config.dtdCatalogCsvFilename}`,
    genericLogger
  );

  const csvContent = Buffer.from(data).toString();
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const recordsArray = Array.isArray(records) ? records : [records];

  const transformedRecords: PublicEService[] = recordsArray.map((record) => ({
    id: record.id,
    name: record.name,
    description: record.description,
    technology: record.technology,
    producerId: record.producerId,
    producerName: record.producerName,
    producerExternalId: record.producerExternalId,
    activeDescriptor: {
      id: record.activeDescriptorId,
      state: record.activeDescriptorState,
      version: record.activeDescriptorVersion,
    },
    attributes: JSON.parse(record.attributes),
  }));

  return z.array(PublicEService).parse(transformedRecords);
};

export const getExportedDtdPublicTenantsFromCsv = async (): Promise<
  PublicTenant[]
> => {
  const data = await fileManager.get(
    config.s3Bucket,
    `${config.dtdCatalogStoragePath}/${config.dtdTenantsCsvFilename}`,
    genericLogger
  );

  const csvContent = Buffer.from(data).toString();
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const recordsArray = Array.isArray(records) ? records : [records];

  const transformedRecords: PublicTenant[] = recordsArray.map((record) => ({
    id: record.id,
    name: record.name,
    externalId: record.externalId,
    attributes: JSON.parse(record.attributes),
  }));

  return z.array(PublicTenant).parse(transformedRecords);
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
