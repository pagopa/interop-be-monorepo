import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  Agreement,
  Attribute,
  Client,
  Delegation,
  EService,
  EServiceTemplate,
  ProducerKeychain,
  Purpose,
  PurposeTemplate,
  Tenant,
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
  splitAgreementIntoObjectsSQL,
  splitAttributeIntoObjectsSQL,
  splitClientIntoObjectsSQL,
  splitDelegationIntoObjectsSQL,
  splitEserviceIntoObjectsSQL,
  splitEServiceTemplateIntoObjectsSQL,
  splitProducerKeychainIntoObjectsSQL,
  splitPurposeIntoObjectsSQL,
  splitTenantIntoObjectsSQL,
  splitPurposeTemplateIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { IMain, ColumnSet, IColumnDescriptor } from "pg-promise";
import { z } from "zod";
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
import { AgreementItemsSchema } from "../src/model/agreement/agreement.js";
import { AttributeSchema } from "../src/model/attribute/attribute.js";
import { ClientItemsSchema } from "../src/model/authorization/client.js";
import { ProducerKeychainItemsSchema } from "../src/model/authorization/producerKeychain.js";
import { EserviceItemsSchema } from "../src/model/catalog/eservice.js";
import { AgreementDbTable } from "../src/model/db/agreement.js";
import { AttributeDbTable } from "../src/model/db/attribute.js";
import {
  ClientDbTable,
  ProducerKeychainDbTable,
} from "../src/model/db/authorization.js";
import { CatalogDbTable } from "../src/model/db/catalog.js";
import { DelegationDbTable } from "../src/model/db/delegation.js";
import { EserviceTemplateDbTable } from "../src/model/db/eserviceTemplate.js";
import { PurposeDbTable } from "../src/model/db/purpose.js";
import { TenantDbTable } from "../src/model/db/tenant.js";
import { DelegationItemsSchema } from "../src/model/delegation/delegation.js";
import { EserviceTemplateItemsSchema } from "../src/model/eserviceTemplate/eserviceTemplate.js";
import { PurposeItemsSchema } from "../src/model/purpose/purpose.js";
import { TenantItemsSchema } from "../src/model/tenant/tenant.js";
import { PurposeTemplateDbTable } from "../src/model/db/purposeTemplate.js";
import { PurposeTemplateItemsSchema } from "../src/model/purposeTemplate/purposeTemplate.js";
export const { cleanup, analyticsPostgresDB, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig"),
    inject("analyticsSQLConfig")
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

export const addOneEServiceTemplate = async (
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

export const addOneAttribute = async (
  attribute: WithMetadata<Attribute>
): Promise<void> => {
  const splitResult = AttributeSchema.parse(
    splitAttributeIntoObjectsSQL(attribute.data, attribute.metadata.version)
  );

  await writeInKpi(AttributeDbTable.attribute, [splitResult]);
};

export const addOneTenant = async (
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

export const addOnePurpose = async (
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

export const addOneDelegation = async (
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

export const addOneAgreement = async (
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

export const addOneClient = async (
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

export const addOneProducerKeychain = async (
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

export const addOnePurposeTemplate = async (
  purposeTemplate: WithMetadata<PurposeTemplate>
): Promise<void> => {
  const splitResult = PurposeTemplateItemsSchema.parse(
    splitPurposeTemplateIntoObjectsSQL(
      purposeTemplate.data,
      purposeTemplate.metadata.version
    )
  );

  await writeInKpi(PurposeTemplateDbTable.purpose_template, [
    splitResult.purposeTemplateSQL,
  ]);

  await writeInKpi(
    PurposeTemplateDbTable.purpose_template_risk_analysis_form,
    splitResult.riskAnalysisFormTemplateSQL
      ? [splitResult.riskAnalysisFormTemplateSQL]
      : []
  );

  await writeInKpi(
    PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
    splitResult.riskAnalysisTemplateAnswersSQL
  );

  await writeInKpi(
    PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
    splitResult.riskAnalysisTemplateAnswersAnnotationsSQL
  );

  await writeInKpi(
    PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
    splitResult.riskAnalysisTemplateAnswersAnnotationsDocumentsSQL
  );
};

function getColumnNameMapper<T extends DomainDbTable>(
  tableName: T
): (columnKey: string) => string {
  const table = DomainDbTableReadModels[tableName] as unknown as Record<
    string,
    { name: string }
  >;
  return (columnKey: string) => table[columnKey]?.name ?? columnKey;
}

function buildColumnSet<T extends DomainDbTable>(
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
    table: { table: tableName },
  });
}

async function writeInKpi<T extends DomainDbTable>(
  tableName: T,
  data: Array<z.infer<DomainDbTableSchemas[T]>>
): Promise<void> {
  if (data.length === 0) {
    return;
  }

  const schema = DomainDbTable[tableName];
  const cs = buildColumnSet(dbContext.pgp, tableName, schema);

  await dbContext.conn.none(dbContext.pgp.helpers.insert(data, cs));
}
