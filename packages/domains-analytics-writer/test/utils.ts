/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { genericLogger } from "pagopa-interop-commons";
import { inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Batch } from "kafkajs";
import { AttributeSchema } from "../src/model/attribute/attribute.js";
import { DBContext, DBConnection } from "../src/db/db.js";
import { config } from "../src/config/config.js";
import { retryConnection } from "../src/db/buildColumnSet.js";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import {
  AgreementDbTable,
  AttributeDbTable,
  CatalogDbTable,
  DeletingDbTable,
  PurposeDbTable,
} from "../src/model/db.js";
import { catalogServiceBuilder } from "../src/service/catalogService.js";
import { agreementServiceBuilder } from "../src/service/agreementService.js";
import { attributeServiceBuilder } from "../src/service/attributeService.js";
import { purposeServiceBuilder } from "../src/service/purposeService.js";

export const { cleanup, analyticsPostgresDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("analyticsSQLDbConfig")
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
      AttributeDbTable.attribute,
      CatalogDbTable.eservice,
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
      PurposeDbTable.purpose,
      PurposeDbTable.purpose_version,
      PurposeDbTable.purpose_version_document,
      PurposeDbTable.purpose_risk_analysis_form,
      PurposeDbTable.purpose_risk_analysis_answer,
    ]);
    await setupDbServiceBuilder(db.conn, config).setupStagingDeletingTables([
      { name: DeletingDbTable.attribute_deleting_table, columns: ["id"] },
      { name: DeletingDbTable.catalog_deleting_table, columns: ["id"] },
      {
        name: DeletingDbTable.catalog_risk_deleting_table,
        columns: ["id", "eservice_id"],
      },
      { name: DeletingDbTable.agreement_deleting_table, columns: ["id"] },
      { name: DeletingDbTable.purpose_deleting_table, columns: ["id"] },
    ]);
  },
  genericLogger
);

export const attributeService = attributeServiceBuilder(dbContext);
export const catalogService = catalogServiceBuilder(dbContext);
export const purposeService = purposeServiceBuilder(dbContext);
export const setupDbService = setupDbServiceBuilder(dbContext.conn, config);

export async function getTablesByName(
  db: DBConnection,
  tables: string[]
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
  db: DBContext
): Promise<any> {
  return db.conn.one(`SELECT * FROM domains.eservice WHERE id = $1`, [
    serviceId,
  ]);
}

export async function getDescriptorFromDb(
  descriptorId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor WHERE id = $1`,
    [descriptorId]
  );
}

export async function getAttributeFromDb(
  id: string,
  db: DBContext
): Promise<AttributeSchema[] | null> {
  return db.conn.any(`SELECT * FROM domains.attribute WHERE id = $1`, [id]);
}

export async function getDescriptorAttributeFromDb(
  id: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(`SELECT * FROM domains.eservice_descriptor_attribute `, [
    id,
  ]);
}

export async function getDocumentFromDb(
  documentId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_document WHERE id = $1`,
    [documentId]
  );
}

export async function getInterfaceFromDb(
  interfaceId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_interface WHERE id = $1`,
    [interfaceId]
  );
}

export async function getRiskAnalysisAnswerFromDb(
  riskAnalysisId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_risk_analysis_answer WHERE id = $1`,
    [riskAnalysisId]
  );
}

export async function getRiskAnalysisFromDb(
  riskAnalysisId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_risk_analysis WHERE id = $1`,
    [riskAnalysisId]
  );
}

export async function getDescriptorRejectionReasonFromDb(
  descriptorId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1`,
    [descriptorId]
  );
}
export async function getDescriptorTemplateVersionFromDb(
  eserviceTemplateVersionId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE eservice_template_version_id = $1`,
    [eserviceTemplateVersionId]
  );
}

export async function getEserviceDescriptorDocumentFromDb(
  descriptorId: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_document WHERE descriptor_id = $1`,
    [descriptorId]
  );
}

export async function resetCatalogTables(dbContext: any): Promise<void> {
  const tables = [
    CatalogDbTable.eservice,
    CatalogDbTable.eservice_descriptor,
    CatalogDbTable.eservice_descriptor_document,
    CatalogDbTable.eservice_descriptor_interface,
    CatalogDbTable.eservice_risk_analysis,
  ];
  await dbContext.conn.none(`TRUNCATE TABLE ${tables.join(",")} CASCADE;`);
}

export const agreementService = agreementServiceBuilder(dbContext);

export async function getAgreementFromDb(id: string, db: DBContext) {
  return db.conn.one(`SELECT * FROM domains.agreement WHERE id = $1`, [id]);
}
export async function getAgreementStampFromDb(agrId: string, db: DBContext) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_stamp WHERE agreement_id = $1`,
    [agrId]
  );
}
export async function getAgreementAttributeFromDb(
  attrId: string,
  db: DBContext
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_attribute WHERE attribute_id = $1`,
    [attrId]
  );
}
export async function getAgreementConsumerDocumentFromDb(
  docId: string,
  db: DBContext
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_consumer_document WHERE id = $1`,
    [docId]
  );
}
export async function getAgreementContractFromDb(
  contractId: string,
  db: DBContext
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

export async function resetPurposeTables(dbContext: any): Promise<void> {
  const tables = [
    PurposeDbTable.purpose,
    PurposeDbTable.purpose_version,
    PurposeDbTable.purpose_version_document,
    PurposeDbTable.purpose_risk_analysis_form,
    PurposeDbTable.purpose_risk_analysis_answer,
  ];
  await dbContext.conn.none(`TRUNCATE TABLE ${tables.join(",")} CASCADE;`);
}

export async function getPurposeFromDb(
  purposeId: string,
  db: DBContext
): Promise<any> {
  return db.conn.oneOrNone(`SELECT * FROM domains.purpose WHERE id = $1`, [
    purposeId,
  ]);
}

export async function getPurposeVersionFromDb(
  versionId: string,
  db: DBContext
): Promise<any> {
  return db.conn.oneOrNone(
    `SELECT * FROM domains.purpose_version WHERE id = $1`,
    [versionId]
  );
}

export async function getVersionDocumentsFromDb(
  versionId: string,
  db: DBContext
): Promise<any[]> {
  return db.conn.any(
    `SELECT * FROM domains.purpose_version_document WHERE purpose_version_id = $1`,
    [versionId]
  );
}

export async function getPurposeRiskAnalysisByPurposeIdFromDb(
  purpose_id: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.purpose_risk_analysis_form WHERE purpose_id = $1`,
    [purpose_id]
  );
}

export async function getPurposeRiskAnalysisAnswerByPurposeIdFromDb(
  purpose_id: string,
  db: DBContext
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.purpose_risk_analysis_answer WHERE purpose_id = $1`,
    [purpose_id]
  );
}
