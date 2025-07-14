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
  EServiceTemplate,
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
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  clientJWKKeyReadModelServiceBuilder,
  clientReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  producerKeychainReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
  producerJWKKeyReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  splitEserviceIntoObjectsSQL,
  splitEServiceTemplateIntoObjectsSQL,
  splitAttributeIntoObjectsSQL,
  splitTenantIntoObjectsSQL,
  splitPurposeIntoObjectsSQL,
  splitDelegationIntoObjectsSQL,
  splitAgreementIntoObjectsSQL,
  splitClientIntoObjectsSQL,
  splitProducerKeychainIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import {
  DBContext,
  readModelServiceBuilderKPI,
} from "../src/services/readModelServiceKPI.js";
import {
  DomainDbTable,
  DomainDbTableReadModels,
  DomainDbTableSchemas,
} from "../src/model/db/index.js";
import { z } from "zod";
import { CatalogDbTable } from "../src/model/db/catalog.js";
import { EserviceItemsSchema } from "../src/model/catalog/eservice.js";
import { ColumnSet, IColumnDescriptor, IMain } from "pg-promise";
import { EserviceTemplateDbTable } from "../src/model/db/eserviceTemplate.js";
import { EserviceTemplateItemsSchema } from "../src/model/eserviceTemplate/eserviceTemplate.js";
import { AttributeDbTable } from "../src/model/db/attribute.js";
import { AttributeSchema } from "../src/model/attribute/attribute.js";
import { TenantItemsSchema } from "../src/model/tenant/tenant.js";
import { TenantDbTable } from "../src/model/db/tenant.js";
import { PurposeDbTable } from "../src/model/db/purpose.js";
import { PurposeItemsSchema } from "../src/model/purpose/purpose.js";
import { DelegationDbTable } from "../src/model/db/delegation.js";
import { DelegationItemsSchema } from "../src/model/delegation/delegation.js";
import { AgreementDbTable } from "../src/model/db/agreement.js";
import { AgreementItemsSchema } from "../src/model/agreement/agreement.js";
import {
  ClientDbTable,
  ProducerKeychainDbTable,
} from "../src/model/db/authorization.js";
import { ClientItemsSchema } from "../src/model/authorization/client.js";
import { ProducerKeychainItemsSchema } from "../src/model/authorization/producerKeychain.js";

export const { cleanup, analyticsPostgresDB, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig"),
    inject("analyticsSQLDbConfig")
  );

afterEach(cleanup);

const connection = await analyticsPostgresDB.connect();

export const dbContext: DBContext = {
  conn: connection,
  pgp: analyticsPostgresDB.$config.pgp,
};

export const readModelServiceKPI = readModelServiceBuilderKPI(dbContext);
export const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

export const eserviceReadModelServiceSQL =
  catalogReadModelServiceBuilder(readModelDB);
export const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);
export const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilder(readModelDB);
export const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
export const purposeReadModelServiceSQL =
  purposeReadModelServiceBuilder(readModelDB);
export const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
export const clientReadModelServiceSQL =
  clientReadModelServiceBuilder(readModelDB);
export const producerKeychainReadModelServiceSQL =
  producerKeychainReadModelServiceBuilder(readModelDB);
export const clientKeysReadModelServiceSQL =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
export const producerKeychainKeyReadModelServiceSQL =
  producerJWKKeyReadModelServiceBuilder(readModelDB);

export const addOneEService = async (
  eservice: WithMetadata<EService>
): Promise<void> => {
  await writeInReadmodel(
    toReadModelEService(eservice.data),
    readModelRepository.eservices,
    eservice.metadata.version
  );
};

export const addOneEServiceTemplate = async (
  eServiceTemplate: WithMetadata<EServiceTemplate>
): Promise<void> => {
  await writeInReadmodel(
    eServiceTemplate.data,
    readModelRepository.eserviceTemplates,
    eServiceTemplate.metadata.version
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

export function getColumnNameMapper<T extends DomainDbTable>(
  tableName: T
): (columnKey: string) => string {
  const table = DomainDbTableReadModels[tableName] as unknown as Record<
    string,
    { name: string }
  >;
  return (columnKey: string) => table[columnKey]?.name ?? columnKey;
}

export function buildColumnSet<T extends DomainDbTable>(
  pgp: IMain,
  tableName: T,
  schema: DomainDbTableSchemas[T]
): ColumnSet<z.infer<DomainDbTableSchemas[T]>> {
  const snakeCaseMapper = getColumnNameMapper(tableName);
  const keys = Object.keys(schema.shape) as Array<keyof z.infer<typeof schema>>;

  const columns = keys.map((prop) => ({
    name: snakeCaseMapper(String(prop)),
    init: ({ source }: IColumnDescriptor<z.infer<typeof schema>>) =>
      source[prop],
  }));

  return new pgp.helpers.ColumnSet(columns, {
    table: { table: `${tableName}` },
  });
}

export async function writeInKpi<T extends DomainDbTable>(
  tableName: T,
  data: z.infer<DomainDbTableSchemas[T]>[]
): Promise<void> {
  const schema = DomainDbTable[tableName];
  const cs = buildColumnSet(dbContext.pgp, tableName, schema);

  await dbContext.conn.none(dbContext.pgp.helpers.insert(data, cs));
}

export const addOneEServiceKpi = async (
  eservice: WithMetadata<EService>
): Promise<void> => {
  const splitResult = EserviceItemsSchema.parse(
    splitEserviceIntoObjectsSQL(eservice.data, eservice.metadata.version)
  );

  await writeInKpi(CatalogDbTable.eservice, [splitResult.eserviceSQL]);
  await writeInKpi(
    CatalogDbTable.eservice_descriptor,
    splitResult.descriptorsSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_descriptor_attribute,
    splitResult.attributesSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_descriptor_document,
    splitResult.documentsSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_descriptor_interface,
    splitResult.interfacesSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_descriptor_rejection_reason,
    splitResult.rejectionReasonsSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_descriptor_template_version_ref,
    splitResult.templateVersionRefsSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_risk_analysis,
    splitResult.riskAnalysesSQL
  );
  await writeInKpi(
    CatalogDbTable.eservice_risk_analysis_answer,
    splitResult.riskAnalysisAnswersSQL
  );
};

export const addOneEServiceTemplateKpi = async (
  eserviceTemplate: WithMetadata<EServiceTemplate>
): Promise<void> => {
  const splitResult = EserviceTemplateItemsSchema.parse(
    splitEServiceTemplateIntoObjectsSQL(
      eserviceTemplate.data,
      eserviceTemplate.metadata.version
    )
  );

  await writeInKpi(EserviceTemplateDbTable.eservice_template, [
    splitResult.eserviceTemplateSQL,
  ]);
  await writeInKpi(
    EserviceTemplateDbTable.eservice_template_version,
    splitResult.versionsSQL
  );
  await writeInKpi(
    EserviceTemplateDbTable.eservice_template_version_attribute,
    splitResult.attributesSQL
  );
  await writeInKpi(
    EserviceTemplateDbTable.eservice_template_version_document,
    splitResult.documentsSQL
  );
  await writeInKpi(
    EserviceTemplateDbTable.eservice_template_version_interface,
    splitResult.interfacesSQL
  );
  await writeInKpi(
    EserviceTemplateDbTable.eservice_template_risk_analysis,
    splitResult.riskAnalysesSQL
  );
  await writeInKpi(
    EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
    splitResult.riskAnalysisAnswersSQL
  );
};

export const addOneAttributeKpi = async (
  attribute: WithMetadata<Attribute>
): Promise<void> => {
  const splitResult = AttributeSchema.parse(
    splitAttributeIntoObjectsSQL(attribute.data, attribute.metadata.version)
  );

  await writeInKpi(AttributeDbTable.attribute, [splitResult]);
};

export const addOneTenantKpi = async (
  tenant: WithMetadata<Tenant>
): Promise<void> => {
  const splitResult = TenantItemsSchema.parse(
    splitTenantIntoObjectsSQL(tenant.data, tenant.metadata.version)
  );

  await writeInKpi(TenantDbTable.tenant, [splitResult.tenantSQL]);
  await writeInKpi(TenantDbTable.tenant_mail, splitResult.mailsSQL);
  await writeInKpi(
    TenantDbTable.tenant_certified_attribute,
    splitResult.certifiedAttributesSQL
  );
  await writeInKpi(
    TenantDbTable.tenant_declared_attribute,
    splitResult.declaredAttributesSQL
  );
  await writeInKpi(
    TenantDbTable.tenant_verified_attribute,
    splitResult.verifiedAttributesSQL
  );
  await writeInKpi(
    TenantDbTable.tenant_verified_attribute_verifier,
    splitResult.verifiedAttributeVerifiersSQL
  );
  await writeInKpi(
    TenantDbTable.tenant_verified_attribute_revoker,
    splitResult.verifiedAttributeRevokersSQL
  );
  await writeInKpi(TenantDbTable.tenant_feature, splitResult.featuresSQL);
};

export const addOnePurposeKpi = async (
  purpose: WithMetadata<Purpose>
): Promise<void> => {
  const splitResult = PurposeItemsSchema.parse(
    splitPurposeIntoObjectsSQL(purpose.data, purpose.metadata.version)
  );

  await writeInKpi(PurposeDbTable.purpose, [splitResult.purposeSQL]);
  await writeInKpi(
    PurposeDbTable.purpose_risk_analysis_form,
    splitResult.riskAnalysisFormSQL ? [splitResult.riskAnalysisFormSQL] : []
  );
  await writeInKpi(
    PurposeDbTable.purpose_risk_analysis_answer,
    splitResult.riskAnalysisAnswersSQL ?? []
  );
  await writeInKpi(PurposeDbTable.purpose_version, splitResult.versionsSQL);
  await writeInKpi(
    PurposeDbTable.purpose_version_document,
    splitResult.versionDocumentsSQL
  );
};

export const addOneDelegationKpi = async (
  delegation: WithMetadata<Delegation>
): Promise<void> => {
  const splitResult = DelegationItemsSchema.parse(
    splitDelegationIntoObjectsSQL(delegation.data, delegation.metadata.version)
  );

  await writeInKpi(DelegationDbTable.delegation, [splitResult.delegationSQL]);
  await writeInKpi(DelegationDbTable.delegation_stamp, splitResult.stampsSQL);
  await writeInKpi(
    DelegationDbTable.delegation_contract_document,
    splitResult.contractDocumentsSQL
  );
};

export const addOneAgreementKpi = async (
  agreement: WithMetadata<Agreement>
): Promise<void> => {
  const splitResult = AgreementItemsSchema.parse(
    splitAgreementIntoObjectsSQL(agreement.data, agreement.metadata.version)
  );

  await writeInKpi(AgreementDbTable.agreement, [splitResult.agreementSQL]);
  await writeInKpi(AgreementDbTable.agreement_stamp, splitResult.stampsSQL);
  await writeInKpi(
    AgreementDbTable.agreement_attribute,
    splitResult.attributesSQL
  );
  await writeInKpi(
    AgreementDbTable.agreement_consumer_document,
    splitResult.consumerDocumentsSQL
  );
  await writeInKpi(
    AgreementDbTable.agreement_contract,
    splitResult.contractSQL ? [splitResult.contractSQL] : []
  );
};

export const addOneClientKpi = async (
  client: WithMetadata<Client>
): Promise<void> => {
  const splitResult = ClientItemsSchema.parse(
    splitClientIntoObjectsSQL(client.data, client.metadata.version)
  );

  await writeInKpi(ClientDbTable.client, [splitResult.clientSQL]);
  await writeInKpi(ClientDbTable.client_user, splitResult.usersSQL);
  await writeInKpi(ClientDbTable.client_purpose, splitResult.purposesSQL);
  await writeInKpi(ClientDbTable.client_key, splitResult.keysSQL);
};

export const addOneProducerKeychainKpi = async (
  producerKeychain: WithMetadata<ProducerKeychain>
): Promise<void> => {
  const splitResult = ProducerKeychainItemsSchema.parse(
    splitProducerKeychainIntoObjectsSQL(
      producerKeychain.data,
      producerKeychain.metadata.version
    )
  );

  await writeInKpi(ProducerKeychainDbTable.producer_keychain, [
    splitResult.producerKeychainSQL,
  ]);
  await writeInKpi(
    ProducerKeychainDbTable.producer_keychain_user,
    splitResult.usersSQL
  );
  await writeInKpi(
    ProducerKeychainDbTable.producer_keychain_eservice,
    splitResult.eservicesSQL
  );
  await writeInKpi(
    ProducerKeychainDbTable.producer_keychain_key,
    splitResult.keysSQL
  );
};

// TODO: addOneClientJWKKeyKpi

// TODO: addOneProducerJWKKeyKpi
