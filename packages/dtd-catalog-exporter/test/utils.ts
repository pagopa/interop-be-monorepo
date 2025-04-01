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

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};
