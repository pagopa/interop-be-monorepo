import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Attribute,
  Client,
  ClientJWKKey,
  Delegation,
  EService,
  ProducerJWKKey,
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
  clientJWKKeyReadModelServiceBuilder,
  clientReadModelServiceBuilderSQL,
  delegationReadModelServiceBuilder,
  producerJWKKeyreadModelServiceBuilder,
  producerKeychainReadModelServiceBuilder,
  purposeReadModelServiceBuilderSQL,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

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
export const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

export const eserviceReadModelServiceSQL =
  catalogReadModelServiceBuilderSQL(readModelDB);
export const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilderSQL(readModelDB);
export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilder(readModelDB);
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
export const clientKeysReadModelServiceSQL =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
export const producerKeychainKeyReadModelServiceSQL =
  producerJWKKeyreadModelServiceBuilder(readModelDB);

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

export const addOneClientJWKKey = async (
  clientJWKKey: WithMetadata<ClientJWKKey>
): Promise<void> => {
  await writeInReadmodel(
    clientJWKKey.data,
    readModelRepository.keys,
    clientJWKKey.metadata.version
  );
};

export const addOneProducerJWKKey = async (
  producerJWKKey: WithMetadata<ProducerJWKKey>
): Promise<void> => {
  await writeInReadmodel(
    producerJWKKey.data,
    readModelRepository.producerKeys,
    producerJWKKey.metadata.version
  );
};
