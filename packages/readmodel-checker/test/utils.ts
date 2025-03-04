import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Attribute,
  Client,
  EService,
  Purpose,
  Tenant,
  toReadModelAgreement,
  toReadModelAttribute,
  toReadModelClient,
  toReadModelEService,
  toReadModelPurpose,
  toReadModelTenant,
  WithMetadata,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  attributeReadModelServiceBuilderSQL,
  catalogReadModelServiceBuilderSQL,
  tenantReadModelServiceBuilderSQL,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const config = inject("tokenGenerationReadModelConfig");

export const { cleanup, readModelRepository, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const readModelService = readModelServiceBuilder(readModelRepository);
export const eserviceReadModelServiceSQL =
  catalogReadModelServiceBuilderSQL(readModelDB);
// const catalogReadModelServiceSQL =
// catalogReadModelServiceBuilderSQL(readModelDB);
export const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilderSQL(readModelDB);
export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilderSQL(readModelDB);

export const addOneEService = async (
  eservice: WithMetadata<EService>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelEService(eservice.data),
    readModelRepository.eservices,
    eservice.metadata.version
  );
};

export const addOneAttribute = async (
  attribute: WithMetadata<Attribute>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelAttribute(attribute.data),
    readModelRepository.attributes,
    attribute.metadata.version
  );
};

export const addOneTenant = async (
  tenant: WithMetadata<Tenant>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelTenant(tenant.data),
    readModelRepository.tenants,
    tenant.metadata.version
  );
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(
    toReadModelPurpose(purpose),
    readModelRepository.purposes
  );
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement),
    readModelRepository.agreements
  );
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeInReadmodel(
    toReadModelClient(client),
    readModelRepository.clients
  );
};
