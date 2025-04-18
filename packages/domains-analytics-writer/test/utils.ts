/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericLogger } from "pagopa-interop-commons";
import { inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Batch } from "kafkajs";
import {
  generateId,
  unsafeBrandId,
  EServiceId,
  DescriptorId,
  AgreementDocumentId,
  AgreementId,
  Agreement,
} from "pagopa-interop-models";
import { AgreementItemsSQL } from "pagopa-interop-readmodel-models";
import { AttributeSchema } from "../src/model/attribute/attribute.js";
import { DBContext, DBConnection } from "../src/db/db.js";
import { config } from "../src/config/config.js";
import { retryConnection } from "../src/db/buildColumnSet.js";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import {
  AgreementDbTable,
  AttributeDbtable,
  CatalogDbTable,
  DeletingDbTable,
} from "../src/model/db.js";
import { attributeServiceBuilder } from "../src/service/attributeService.js";
import { catalogServiceBuilder } from "../src/service/catalogService.js";
import { agreementServiceBuilder } from "../src/service/agreementService.js";
import { splitAgreementIntoObjectsSQL } from "pagopa-interop-readmodel";

export const { cleanup, analyticsPostgresDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("analyticsSQLDbConfig"),
);
const connection = await analyticsPostgresDB.connect();

export const dbContext: DBContext = {
  conn: connection,
  pgp: analyticsPostgresDB.$config.pgp,
};

await retryConnection(
  analyticsPostgresDB,
  dbContext,
  config,
  async (db) => {
    await setupDbServiceBuilder(db.conn, config).setupStagingTables([
      AttributeDbtable.attribute,
      CatalogDbTable.eservice,
      CatalogDbTable.eservice_template_ref,
      CatalogDbTable.eservice_descriptor,
      CatalogDbTable.eservice_descriptor_template_version_ref,
      CatalogDbTable.eservice_descriptor_rejection_reason,
      CatalogDbTable.eservice_descriptor_interface,
      CatalogDbTable.eservice_descriptor_document,
      CatalogDbTable.eservice_descriptor_attribute,
      CatalogDbTable.eservice_risk_analysis,
      CatalogDbTable.eservice_risk_analysis_answer,
      AgreementDbTable.agreement,
      AgreementDbTable.agreement_stamp,
      AgreementDbTable.agreement_attribute,
      AgreementDbTable.agreement_consumer_document,
      AgreementDbTable.agreement_contract,
    ]);
    await setupDbServiceBuilder(db.conn, config).setupStagingDeletingByIdTables(
      [
        DeletingDbTable.catalog_deleting_table,
        DeletingDbTable.attribute_deleting_table,
        DeletingDbTable.agreement_deleting_table,
      ],
    );
  },
  genericLogger,
);

export const attributeService = attributeServiceBuilder(dbContext);
export const catalogService = catalogServiceBuilder(dbContext);
export const setupDbService = setupDbServiceBuilder(dbContext.conn, config);

export async function getTablesByName(
  db: DBConnection,
  tables: string[],
): Promise<Array<{ tablename: string }>> {
  const query = `
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname LIKE 'pg_temp%' 
        AND tablename IN ($1:csv);
    `;
  return await db.query<Array<{ tablename: string }>>(query, [tables]);
}

export const mockAttributeBatch: Batch = {
  topic: config.attributeTopic,
  partition: 0,
  highWatermark: "0",
  messages: [
    {
      value: { event_version: 1 },
    } as any,
  ],
  isEmpty: () => false,
  firstOffset: () => "0",
  lastOffset: () => "0",
  offsetLag: () => "0",
  offsetLagLow: () => "0",
};

export const mockCatalogBatch: Batch = {
  topic: config.catalogTopic,
  partition: 0,
  highWatermark: "0",
  messages: [
    {
      value: { event_version: 1 },
    } as any,
    {
      value: { event_version: 2 },
    } as any,
  ],
  isEmpty: () => false,
  firstOffset: () => "0",
  lastOffset: () => "0",
  offsetLag: () => "0",
  offsetLagLow: () => "0",
};

export async function getEserviceFromDb(
  serviceId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.one(`SELECT * FROM domains.eservice WHERE id = $1`, [
    serviceId,
  ]);
}

export async function getDescriptorFromDb(
  descriptorId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor WHERE id = $1`,
    [descriptorId],
  );
}

export async function getAttributeFromDb(
  id: string,
  db: DBContext,
): Promise<AttributeSchema[] | null> {
  return db.conn.any(`SELECT * FROM domains.attribute WHERE id = $1`, [id]);
}

export async function getDescriptorAttributeFromDb(
  id: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(`SELECT * FROM domains.eservice_descriptor_attribute `, [
    id,
  ]);
}

export async function getDocumentFromDb(
  documentId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_document WHERE id = $1`,
    [documentId],
  );
}

export async function getInterfaceFromDb(
  interfaceId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_interface WHERE id = $1`,
    [interfaceId],
  );
}

export async function getRiskAnalysisAnswerFromDb(
  riskAnalysisId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_risk_analysis_answer WHERE id = $1`,
    [riskAnalysisId],
  );
}

export async function getRiskAnalysisFromDb(
  riskAnalysisId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_risk_analysis WHERE id = $1`,
    [riskAnalysisId],
  );
}

export async function getDescriptorRejectionReasonFromDb(
  descriptorId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1`,
    [descriptorId],
  );
}
export async function getDescriptorTemplateVersionFromDb(
  eserviceTemplateVersionId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE eservice_template_version_id = $1`,
    [eserviceTemplateVersionId],
  );
}
export async function getEserviceTemplateRefFromDb(
  eserviceTemplateId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_template_ref WHERE eservice_template_id = $1`,
    [eserviceTemplateId],
  );
}
export async function getEserviceDescriptorDocumentFromDb(
  descriptorId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_document WHERE descriptor_id = $1`,
    [descriptorId],
  );
}

export const eserviceId = generateId();
export const descriptorId = generateId();
export const interfaceId = generateId();
export const documentId = generateId();
export const riskAnalysisId = generateId();

export const eserviceSQL = {
  id: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  producerId: generateId(),
  name: "Test E-Service Full",
  description: "Test eService with complete sub-objects",
  technology: "REST",
  createdAt: new Date().toISOString(),
  mode: "active",
  isSignalHubEnabled: true,
  isConsumerDelegable: false,
  isClientAccessDelegable: false,
};

export const descriptorSQL = {
  id: unsafeBrandId<DescriptorId>(descriptorId),
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  version: "v1",
  description: "Full Descriptor",
  state: "Published",
  audience: ["IT"],
  docs: [],
  attributes: { declared: [], verified: [], certified: [] },
  voucherLifespan: 3600,
  dailyCallsPerConsumer: 50,
  dailyCallsTotal: 500,
  agreementApprovalPolicy: "Automatic",
  createdAt: new Date().toISOString(),
  serverUrls: ["https://api.example.com"],
  publishedAt: new Date().toISOString(),
  suspendedAt: null,
  deprecatedAt: null,
  archivedAt: null,
  voucher_lifespan: "123321",
};

export const interfaceSQL = {
  id: interfaceId,
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  descriptorId,
  name: "Test Interface",
  contentType: "application/json",
  prettyName: "interface.json",
  path: "/interfaces/interface.json",
  checksum: "chk-interface",
  uploadDate: new Date().toISOString(),
};

export const documentSQL = {
  id: documentId,
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  descriptorId,
  name: "Test Document",
  contentType: "application/pdf",
  prettyName: "document.pdf",
  path: "/docs/document.pdf",
  checksum: "chk-document",
  uploadDate: new Date().toISOString(),
};

const riskAnalysisFormId = generateId();
const riskAnalysisSQL = {
  id: riskAnalysisId,
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  name: "Test Risk Analysis",
  createdAt: new Date().toISOString(),
  riskAnalysisFormId,
  riskAnalysisFormVersion: "1.0",
};

export const sampleRiskAnswer = {
  id: generateId(),
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  riskAnalysisFormId,
  kind: "someKind",
  key: "someKey",
  value: "someValue",
};

export const sampleTemplateRef = {
  eserviceTemplateId: generateId(),
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  instance_label: "Sample Template",
};

export const sampleAttribute = {
  attributeId: generateId(),
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  descriptorId,
  explicitAttributeVerification: true,
  kind: "sampleAttribute",
  groupId: 1,
};

export const sampleRejectionReason = {
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  descriptorId,
  rejectionReason: "Test rejection",
  rejectedAt: new Date().toISOString(),
};

export const sampleTemplateVersionRef = {
  eserviceTemplateVersionId: generateId(),
  eserviceId: unsafeBrandId<EServiceId>(eserviceId),
  metadataVersion: 1,
  descriptorId,
  contact_name: "John Doe",
  contact_email: "john@example.com",
  contact_url: "https://example.com",
  terms_and_conditions_url: "https://example.com/terms",
};

export const eserviceItem = {
  eserviceSQL,
  templateRefSQL: [sampleTemplateRef],
  riskAnalysesSQL: [riskAnalysisSQL],
  riskAnalysisAnswersSQL: [sampleRiskAnswer],
  descriptorsSQL: [descriptorSQL],
  attributesSQL: [sampleAttribute],
  interfacesSQL: [interfaceSQL],
  documentsSQL: [documentSQL],
  rejectionReasonsSQL: [sampleRejectionReason],
  templateVersionRefsSQL: [sampleTemplateVersionRef],
} as any;

export async function resetCatalogTables(dbContext: any): Promise<void> {
  const tables = [
    CatalogDbTable.eservice,
    CatalogDbTable.eservice_descriptor,
    CatalogDbTable.eservice_template_ref,
    CatalogDbTable.eservice_descriptor_document,
    CatalogDbTable.eservice_descriptor_interface,
    CatalogDbTable.eservice_risk_analysis,
  ];
  await dbContext.conn.none(`TRUNCATE TABLE ${tables.join(",")} CASCADE;`);
}

export function createBaseEserviceItem(overrides?: any): any {
  return {
    eserviceSQL: overrides ? { ...overrides } : eserviceSQL,
    templateRefSQL: [],
    riskAnalysesSQL: [],
    riskAnalysisAnswersSQL: [],
    descriptorsSQL: [],
    attributesSQL: [],
    interfacesSQL: [],
    documentsSQL: [],
    rejectionReasonsSQL: [],
    templateVersionRefsSQL: [],
  };
}

export const agreementService = agreementServiceBuilder(dbContext);

export async function getAgreementFromDb(id: string, db: DBContext) {
  return db.conn.one(`SELECT * FROM domains.agreement WHERE id = $1`, [id]);
}
export async function getAgreementStampFromDb(agrId: string, db: DBContext) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_stamp WHERE agreement_id = $1`,
    [agrId],
  );
}
export async function getAgreementAttributeFromDb(
  attrId: string,
  db: DBContext,
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_attribute WHERE attribute_id = $1`,
    [attrId],
  );
}
export async function getAgreementConsumerDocumentFromDb(
  docId: string,
  db: DBContext,
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_consumer_document WHERE id = $1`,
    [docId],
  );
}
export async function getAgreementContractFromDb(
  contractId: string,
  db: DBContext,
) {
  return db.conn.any(`SELECT * FROM domains.agreement_contract WHERE id = $1`, [
    contractId,
  ]);
}

export async function resetAgreementTables(db: DBContext): Promise<void> {
  const tbls = [
    AgreementDbTable.agreement,
    AgreementDbTable.agreement_stamp,
    AgreementDbTable.agreement_attribute,
    AgreementDbTable.agreement_consumer_document,
    AgreementDbTable.agreement_contract,
  ];
  await db.conn.none(`TRUNCATE TABLE ${tbls.join(",")} CASCADE;`);
}

export const agreementId = generateId();
export const docId = generateId();
export const contractId = generateId();

export const agreementSQL = {
  id: unsafeBrandId<AgreementId>(agreementId),
  metadataVersion: 1,
  eserviceId: generateId(),
  descriptorId: generateId(),
  producerId: generateId(),
  consumerId: generateId(),
  state: "ACTIVE",
  suspendedByConsumer: null,
  suspendedByProducer: null,
  suspendedByPlatform: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
  consumerNotes: null,
  rejectionReason: null,
  suspendedAt: null,
};

export const stampSQL = {
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  who: generateId(),
  delegationId: null,
  when: new Date().toISOString(),
  kind: "Producer",
};

export const attributeSQL = {
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  attributeId: generateId(),
  kind: "verified",
};

export const consumerDocSQL = {
  id: unsafeBrandId<AgreementDocumentId>(docId),
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  name: "sampledoc.pdf",
  prettyName: "sampledoc.pdf",
  contentType: "application/pdf",
  path: "/docs/sample.pdf",
  createdAt: new Date().toISOString(),
};

export const contractDocSQL = {
  id: unsafeBrandId<AgreementDocumentId>(contractId),
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  name: "contract.pdf",
  prettyName: "contract.pdf",
  contentType: "application/pdf",
  path: "/docs/contract.pdf",
  createdAt: new Date().toISOString(),
};

export const agreementItem: AgreementItemsSQL = {
  agreementSQL,
  stampsSQL: [stampSQL],
  attributesSQL: [attributeSQL],
  consumerDocumentsSQL: [consumerDocSQL],
  contractSQL: contractDocSQL,
};

export function getMockAgreement(
  overrides: Partial<Agreement> = {},
): Agreement & { metadataVersion: number } {
  const agreementId = unsafeBrandId<AgreementId>(generateId());
  const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
  return {
    id: agreementId,
    metadataVersion: 1,
    eserviceId: generateId(),
    descriptorId: generateId(),
    producerId: generateId(),
    consumerId: generateId(),
    state: "Active",
    suspendedByConsumer: false,
    suspendedByProducer: false,
    suspendedByPlatform: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    consumerNotes: "consumer notes",
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    contract: {
      id: unsafeBrandId<AgreementDocumentId>(contractId),
      name: "contract.pdf",
      prettyName: "contract.pdf",
      contentType: "application/pdf",
      path: "/docs/contract.pdf",
      createdAt: new Date(),
    },
    stamps: {},
    ...overrides,
  };
}

export function agreementItemFromDomain(
  agr: Agreement & { metadataVersion: number },
): AgreementItemsSQL {
  const split = splitAgreementIntoObjectsSQL(agr, agr.metadataVersion);
  return split;
}
