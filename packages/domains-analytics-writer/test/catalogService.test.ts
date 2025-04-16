/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, beforeEach, expect } from "vitest";
import { EServiceId, generateId, unsafeBrandId } from "pagopa-interop-models";
import { catalogServiceBuilder } from "../src/service/catalogService.js";
import {
  dbContext,
  getEserviceFromDb,
  getDescriptorFromDb,
  getDocumentFromDb,
  getInterfaceFromDb,
  getRiskAnalysisFromDb,
  eserviceItem,
  descriptorId,
  documentId,
  eserviceId,
  interfaceId,
  riskAnalysisId,
  sampleAttribute,
  sampleRejectionReason,
  sampleRiskAnswer,
  sampleTemplateRef,
  sampleTemplateVersionRef,
} from "./utils.js";
import { CatalogDbTable } from "../src/model/db.js";

describe("Catalog Service - Batch Operations", () => {
  beforeEach(async () => {
    // Truncate all staging/target tables before each test.
    await dbContext.conn.none(
      `TRUNCATE TABLE ${CatalogDbTable.eservice} CASCADE;`,
    );
    await dbContext.conn.none(
      `TRUNCATE TABLE ${CatalogDbTable.eservice_descriptor} CASCADE;`,
    );
    await dbContext.conn.none(
      `TRUNCATE TABLE ${CatalogDbTable.eservice_template_ref} CASCADE;`,
    );
    await dbContext.conn.none(
      `TRUNCATE TABLE ${CatalogDbTable.eservice_descriptor_document} CASCADE;`,
    );
    await dbContext.conn.none(
      `TRUNCATE TABLE ${CatalogDbTable.eservice_descriptor_interface} CASCADE;`,
    );
    await dbContext.conn.none(
      `TRUNCATE TABLE ${CatalogDbTable.eservice_risk_analysis} CASCADE;`,
    );
  });

  it("upsertBatchEservice - successfully inserts a complete eService with all sub-objects", async () => {
    const catalogService = catalogServiceBuilder(dbContext);
    await catalogService.upsertBatchEservice([eserviceItem], dbContext);

    // Verify main eService record.
    const storedEservice = await getEserviceFromDb(eserviceId, dbContext);
    expect(storedEservice).toBeDefined();
    expect(storedEservice.metadata_version).toBe(1);

    // Verify descriptor.
    const storedDescriptors = await getDescriptorFromDb(
      descriptorId,
      dbContext,
    );
    expect(storedDescriptors.length).toBeGreaterThan(0);
    expect(storedDescriptors[0].id).toBe(descriptorId);

    // Verify interface.
    const storedInterfaces = await getInterfaceFromDb(interfaceId, dbContext);
    expect(storedInterfaces.length).toBeGreaterThan(0);
    expect(storedInterfaces[0].id).toBe(interfaceId);

    // Verify document.
    const storedDocuments = await getDocumentFromDb(documentId, dbContext);
    expect(storedDocuments.length).toBeGreaterThan(0);
    expect(storedDocuments[0].name).toBe("Test Document");

    // Verify risk analysis.
    const storedRiskAnalysis = await getRiskAnalysisFromDb(
      riskAnalysisId,
      dbContext,
    );
    expect(storedRiskAnalysis.length).toBeGreaterThan(0);
    expect(storedRiskAnalysis[0].id).toBe(riskAnalysisId);

    // Verify additional child objects via direct queries.
    const storedRiskAnswer = await dbContext.conn.any(
      `SELECT * FROM domains.eservice_risk_analysis_answer WHERE id = $1`,
      [sampleRiskAnswer.id],
    );
    expect(storedRiskAnswer.length).toBeGreaterThan(0);

    const storedTemplateRef = await dbContext.conn.any(
      `SELECT * FROM domains.eservice_template_ref WHERE eservice_template_id = $1`,
      [sampleTemplateRef.eserviceTemplateId],
    );
    expect(storedTemplateRef.length).toBeGreaterThan(0);

    const storedAttribute = await dbContext.conn.any(
      `SELECT * FROM domains.eservice_descriptor_attribute WHERE attribute_id = $1`,
      [sampleAttribute.attributeId],
    );
    expect(storedAttribute.length).toBeGreaterThan(0);

    const storedRejectionReason = await dbContext.conn.any(
      `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1 AND rejection_reason = $2`,
      [descriptorId, sampleRejectionReason.rejectionReason],
    );
    expect(storedRejectionReason.length).toBeGreaterThan(0);

    const storedTemplateVersionRef = await dbContext.conn.any(
      `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE eservice_template_version_id = $1`,
      [sampleTemplateVersionRef.eserviceTemplateVersionId],
    );
    expect(storedTemplateVersionRef.length).toBeGreaterThan(0);
  });

  it("upsertBatchEServiceDescriptor - fails if eservice_id does not exist", async () => {
    const nonExistentServiceId = generateId();
    const descriptorId = generateId();
    const descriptorData = {
      id: descriptorId,
      eserviceId: unsafeBrandId<EServiceId>(nonExistentServiceId),
      metadataVersion: 1,
      version: "v1",
      description: "Descriptor with invalid eservice",
      state: "Published",
      audience: ["IT"],
      docs: [],
      attributes: {},
      voucher_lifespan: 3600,
      dailyCallsPerConsumer: 50,
      dailyCallsTotal: 500,
      agreementApprovalPolicy: "Automatic",
      createdAt: new Date().toISOString(),
      serverUrls: ["https://api.example.com"],
      publishedAt: new Date().toISOString(),
      suspendedAt: null,
      deprecatedAt: null,
      archivedAt: null,
    };

    const descriptorItem = {
      descriptorData,
      eserviceId: unsafeBrandId<EServiceId>(nonExistentServiceId),
      metadataVersion: 1,
    } as any;

    const catalogService = catalogServiceBuilder(dbContext);
    await expect(
      catalogService.upsertBatchEServiceDescriptor([descriptorItem], dbContext),
    ).rejects.toThrow();
  });
});
