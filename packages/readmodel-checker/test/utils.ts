import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Attribute,
  Client,
  Delegation,
  EService,
  ProducerKeychain,
  Purpose,
  Tenant,
  toReadModelAgreement,
  toReadModelAttribute,
  toReadModelClient,
  toReadModelEService,
  toReadModelProducerKeychain,
  toReadModelPurpose,
  toReadModelTenant,
  WithMetadata,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  agreementReadModelServiceBuilderSQL,
  attributeReadModelServiceBuilderSQL,
  catalogReadModelServiceBuilderSQL,
  clientReadModelServiceBuilderSQL,
  delegationReadModelServiceBuilder,
  producerKeychainReadModelServiceBuilder,
  purposeReadModelServiceBuilderSQL,
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
export const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilderSQL(readModelDB);
export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilderSQL(readModelDB);
export const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilderSQL(readModelDB);
export const purposeReadModelServiceSQL =
  purposeReadModelServiceBuilderSQL(readModelDB);
export const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
export const clientReadModelServiceSQL =
  clientReadModelServiceBuilderSQL(readModelDB);
export const producerKeychainReadModelServiceSQL =
  producerKeychainReadModelServiceBuilder(readModelDB);

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

export const addOnePurpose = async (
  purpose: WithMetadata<Purpose>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelPurpose(purpose.data),
    readModelRepository.purposes,
    purpose.metadata.version
  );
};

export const addOneDelegation = async (
  delegation: WithMetadata<Delegation>
): Promise<void> => {
  await writeInReadmodel(
    delegation.data,
    readModelRepository.delegations,
    delegation.metadata.version
  );
};

export const addOneAgreement = async (
  agreement: WithMetadata<Agreement>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement.data),
    readModelRepository.agreements,
    agreement.metadata.version
  );
};

export const addOneClient = async (
  client: WithMetadata<Client>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelClient(client.data),
    readModelRepository.clients,
    client.metadata.version
  );
};

export const addOneProducerKeychain = async (
  producerKeychain: WithMetadata<ProducerKeychain>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelProducerKeychain(producerKeychain.data),
    readModelRepository.producerKeychains,
    producerKeychain.metadata.version
  );
};
