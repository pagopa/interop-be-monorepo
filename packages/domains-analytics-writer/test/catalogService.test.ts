/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  descriptorSQL,
  eserviceSQL,
  sampleRiskAnswer,
  sampleTemplateRef,
  sampleAttribute,
  sampleRejectionReason,
  sampleTemplateVersionRef,
  getDescriptorAttributeFromDb,
  resetDb,
  createBaseEserviceItem,
} from "./utils.js";

describe("Catalog Service - Batch Operations", () => {
  beforeEach(async () => {
    await resetDb(dbContext);
  });

  describe("Upsert Operations", () => {
    describe("EService Upsert", () => {
      it("should insert a complete eService with all sub-objects", async () => {
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([eserviceItem], dbContext);

        const storedEservice = await getEserviceFromDb(
          eserviceItem.eserviceSQL.id,
          dbContext
        );
        expect(storedEservice).toBeDefined();
        expect(storedEservice.metadata_version).toBe(1);

        const storedDescriptors = await getDescriptorFromDb(
          eserviceItem.descriptorsSQL[0].id,
          dbContext
        );
        expect(storedDescriptors.length).toBeGreaterThan(0);

        const storedInterfaces = await getInterfaceFromDb(
          eserviceItem.interfacesSQL[0].id,
          dbContext
        );
        expect(storedInterfaces.length).toBeGreaterThan(0);

        const storedDocuments = await getDocumentFromDb(
          eserviceItem.documentsSQL[0].id,
          dbContext
        );
        expect(storedDocuments.length).toBeGreaterThan(0);

        const storedRiskAnalysis = await getRiskAnalysisFromDb(
          eserviceItem.riskAnalysesSQL[0].id,
          dbContext
        );
        expect(storedRiskAnalysis.length).toBeGreaterThan(0);

        // Verify sub-objects inserted via direct queries
        const storedRiskAnswer = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_risk_analysis_answer WHERE id = $1`,
          [sampleRiskAnswer.id]
        );
        expect(storedRiskAnswer.length).toBeGreaterThan(0);

        const storedTemplateRef = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_template_ref WHERE eservice_template_id = $1`,
          [sampleTemplateRef.eserviceTemplateId]
        );
        expect(storedTemplateRef.length).toBeGreaterThan(0);

        const storedAttribute = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_attribute WHERE attribute_id = $1`,
          [sampleAttribute.attributeId]
        );
        expect(storedAttribute.length).toBeGreaterThan(0);

        const storedRejectionReason = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1 AND rejection_reason = $2`,
          [
            eserviceItem.descriptorsSQL[0].id,
            sampleRejectionReason.rejectionReason,
          ]
        );
        expect(storedRejectionReason.length).toBeGreaterThan(0);

        const storedTemplateVersionRef = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE eservice_template_version_id = $1`,
          [sampleTemplateVersionRef.eserviceTemplateVersionId]
        );
        expect(storedTemplateVersionRef.length).toBeGreaterThan(0);
      });
    });

    describe("Descriptor Upsert", () => {
      it("should fail if eService_id does not exist", async () => {
        const nonExistentServiceId = generateId();
        const descriptorId = generateId();
        const descriptorData = {
          id: descriptorId,
          eserviceId: unsafeBrandId<EServiceId>(nonExistentServiceId),
          metadataVersion: 1,
          version: "v1",
          description: "Descriptor with invalid eService",
          state: "Published",
          audience: ["IT"],
          docs: [],
          attributes: {},
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
        };
        const descriptorItem = {
          descriptorData,
          eserviceId: unsafeBrandId<EServiceId>(nonExistentServiceId),
          metadataVersion: 1,
        };

        const catalogService = catalogServiceBuilder(dbContext);
        await expect(
          catalogService.upsertBatchEServiceDescriptor(
            [descriptorItem] as any,
            dbContext
          )
        ).rejects.toThrow();
      });

      it("should insert and merge a descriptor successfully", async () => {
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([eserviceItem], dbContext);
        const eserviceBase = createBaseEserviceItem();
        const descriptorItem = {
          descriptorData: { ...eserviceBase, descriptorSQL },
          eserviceId: descriptorSQL.eserviceId,
          metadataVersion: descriptorSQL.metadataVersion,
        };

        await catalogService.upsertBatchEServiceDescriptor(
          [descriptorItem],
          dbContext
        );

        const storedDescriptors = await getDescriptorFromDb(
          descriptorSQL.id,
          dbContext
        );
        expect(storedDescriptors.length).toBe(1);

        const storedInterface = await getInterfaceFromDb(
          eserviceItem.interfacesSQL[0].id,
          dbContext
        );
        expect(storedInterface.length).toBe(1);

        const storedDocument = await getDocumentFromDb(
          eserviceItem.documentsSQL[0].id,
          dbContext
        );
        expect(storedDocument.length).toBe(1);

        const storedAttributes = await getDescriptorAttributeFromDb(
          eserviceItem.attributesSQL[0].attributeId,
          dbContext
        );
        expect(storedAttributes?.length).toBeGreaterThan(0);

        const storedRejectionReasons = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1`,
          [descriptorSQL.id]
        );
        expect(storedRejectionReasons.length).toBe(1);

        const storedTemplateVersionRef = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE descriptor_id = $1`,
          [descriptorSQL.id]
        );
        expect(storedTemplateVersionRef.length).toBe(1);
      });
    });

    describe("Document Upsert", () => {
      it("should insert and merge a document successfully", async () => {
        const baseEserviceItem = createBaseEserviceItem();
        baseEserviceItem.descriptorsSQL.push(descriptorSQL);
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([baseEserviceItem], dbContext);

        const docId = generateId();
        const documentSQL = {
          id: docId,
          eserviceId: unsafeBrandId<EServiceId>(eserviceSQL.id),
          metadataVersion: 1,
          descriptorId: descriptorSQL.id,
          name: "Test Document for Upsert",
          contentType: "application/pdf",
          prettyName: "upsert.pdf",
          path: "/docs/upsert.pdf",
          checksum: "checksum-document",
          uploadDate: new Date().toISOString(),
        };

        await catalogService.upsertBatchEServiceDocument(
          [documentSQL],
          dbContext
        );
        const storedDocument = await getDocumentFromDb(docId, dbContext);
        expect(storedDocument.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Delete Operations", () => {
    describe("EService Delete", () => {
      it("should mark an eService and all its sub-objects as deleted", async () => {
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([eserviceItem], dbContext);
        await catalogService.deleteBatchEService(
          [eserviceItem.eserviceSQL.id],
          dbContext
        );

        const storedEservice = await getEserviceFromDb(
          eserviceItem.eserviceSQL.id,
          dbContext
        );
        expect(storedEservice.deleted).toBe(true);

        const storedDescriptors = await getDescriptorFromDb(
          eserviceItem.descriptorsSQL[0].id,
          dbContext
        );
        storedDescriptors.forEach((d: { deleted: any }) =>
          expect(d.deleted).toBe(true)
        );

        const storedInterfaces = await getInterfaceFromDb(
          eserviceItem.interfacesSQL[0].id,
          dbContext
        );
        storedInterfaces.forEach((i: { deleted: any }) =>
          expect(i.deleted).toBe(true)
        );

        const storedDocuments = await getDocumentFromDb(
          eserviceItem.documentsSQL[0].id,
          dbContext
        );
        storedDocuments.forEach((d: { deleted: any }) =>
          expect(d.deleted).toBe(true)
        );

        const storedRiskAnalysis = await getRiskAnalysisFromDb(
          eserviceItem.riskAnalysesSQL[0].id,
          dbContext
        );
        storedRiskAnalysis.forEach((r: { deleted: any }) =>
          expect(r.deleted).toBe(true)
        );

        const storedRiskAnswer = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_risk_analysis_answer WHERE id = $1`,
          [sampleRiskAnswer.id]
        );
        storedRiskAnswer.forEach((r) => expect(r.deleted).toBe(true));

        const storedTemplateRef = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_template_ref WHERE eservice_template_id = $1`,
          [sampleTemplateRef.eserviceTemplateId]
        );
        storedTemplateRef.forEach((t) => expect(t.deleted).toBe(true));

        const storedAttributes = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_attribute WHERE attribute_id = $1`,
          [sampleAttribute.attributeId]
        );
        storedAttributes.forEach((a) => expect(a.deleted).toBe(true));

        const storedRejectionReasons = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1 AND rejection_reason = $2`,
          [
            eserviceItem.descriptorsSQL[0].id,
            sampleRejectionReason.rejectionReason,
          ]
        );
        storedRejectionReasons.forEach((r) => expect(r.deleted).toBe(true));

        const storedTemplateVersionRefs = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE eservice_template_version_id = $1`,
          [sampleTemplateVersionRef.eserviceTemplateVersionId]
        );
        storedTemplateVersionRefs.forEach((t) => expect(t.deleted).toBe(true));
      });
    });

    describe("Descriptor Delete", () => {
      it("should mark a descriptor and its related sub-objects as deleted", async () => {
        const validEserviceId = generateId();
        const baseEserviceSQL = {
          id: unsafeBrandId<EServiceId>(validEserviceId),
          metadataVersion: 1,
          producerId: generateId(),
          name: "Eservice for Descriptor Deletion",
          description: "Eservice to test descriptor deletion",
          technology: "REST",
          createdAt: new Date().toISOString(),
          mode: "active",
          isSignalHubEnabled: true,
          isConsumerDelegable: false,
          isClientAccessDelegable: false,
        };

        const baseEserviceItem = createBaseEserviceItem(baseEserviceSQL);
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([baseEserviceItem], dbContext);

        const newDescriptorId = generateId();
        const descriptorData = {
          id: newDescriptorId,
          eserviceId: baseEserviceSQL.id,
          metadataVersion: 1,
          version: "v1",
          description: "Descriptor to delete",
          state: "Published",
          audience: ["IT"],
          docs: [],
          attributes: {
            declared: [
              [
                {
                  id: generateId(),
                  name: "Test Attribute",
                  kind: "sample",
                  description: "desc",
                  origin: "test",
                  creationTime: new Date().toISOString(),
                  explicitAttributeVerification: true,
                },
              ],
            ],
            verified: [[]],
            certified: [[]],
          },
          voucherLifespan: 3600,
          dailyCallsPerConsumer: 100,
          dailyCallsTotal: 1000,
          agreementApprovalPolicy: "Automatic",
          createdAt: new Date().toISOString(),
          serverUrls: ["https://api.example.com"],
          publishedAt: new Date().toISOString(),
          suspendedAt: null,
          deprecatedAt: null,
          archivedAt: null,
        };

        const eserviceWithDescriptor = {
          ...baseEserviceItem,
          descriptorSQL: descriptorData,
        };

        const descriptorItem = {
          descriptorData: eserviceWithDescriptor,
          eserviceId: baseEserviceSQL.id,
          metadataVersion: 1,
        };

        await catalogService.upsertBatchEServiceDescriptor(
          [descriptorItem],
          dbContext
        );
        await catalogService.deleteBatchDescriptor(
          [newDescriptorId],
          dbContext
        );

        const storedDescriptors = await getDescriptorFromDb(
          newDescriptorId,
          dbContext
        );
        expect(storedDescriptors[0].deleted).toBe(true);

        const descriptorAttributes = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_attribute WHERE descriptor_id = $1`,
          [newDescriptorId]
        );
        descriptorAttributes.forEach((attr) => expect(attr.deleted).toBe(true));

        const descriptorDocs = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_document WHERE descriptor_id = $1`,
          [newDescriptorId]
        );
        descriptorDocs.forEach((doc) => expect(doc.deleted).toBe(true));

        const descriptorInterfaces = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_interface WHERE descriptor_id = $1`,
          [newDescriptorId]
        );
        descriptorInterfaces.forEach((intf) => expect(intf.deleted).toBe(true));

        const rejectionReasons = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_rejection_reason WHERE descriptor_id = $1`,
          [newDescriptorId]
        );
        rejectionReasons.forEach((reason) => expect(reason.deleted).toBe(true));

        const templateVersionRefs = await dbContext.conn.any(
          `SELECT * FROM domains.eservice_descriptor_template_version_ref WHERE descriptor_id = $1`,
          [newDescriptorId]
        );
        templateVersionRefs.forEach((ref) => expect(ref.deleted).toBe(true));
      });
    });

    describe("Risk Analysis Delete", () => {
      it("should mark a risk analysis and its answers as deleted", async () => {
        const riskEserviceId = generateId();
        const riskAnalysisFormId = generateId();
        const riskAnalysisIdForDeletion = generateId();

        const baseEserviceSQL = {
          id: unsafeBrandId<EServiceId>(riskEserviceId),
          metadataVersion: 1,
          producerId: generateId(),
          name: "E-Service for Risk Analysis",
          description: "Testing risk analysis deletion",
          technology: "REST",
          createdAt: new Date().toISOString(),
          mode: "active",
          isSignalHubEnabled: true,
          isConsumerDelegable: false,
          isClientAccessDelegable: false,
        };

        const riskAnalysisSQL = {
          id: riskAnalysisIdForDeletion,
          eserviceId: baseEserviceSQL.id,
          metadataVersion: 1,
          name: "Risk Analysis To Delete",
          createdAt: new Date().toISOString(),
          riskAnalysisFormId,
          riskAnalysisFormVersion: "1.0",
        };

        const riskAnalysisEserviceItem =
          createBaseEserviceItem(baseEserviceSQL);
        riskAnalysisEserviceItem.riskAnalysesSQL.push(riskAnalysisSQL);

        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice(
          [riskAnalysisEserviceItem],
          dbContext
        );
        await catalogService.deleteBatchEserviceRiskAnalysis(
          [riskAnalysisIdForDeletion],
          dbContext
        );

        const storedRiskAnalysis = await getRiskAnalysisFromDb(
          riskAnalysisIdForDeletion,
          dbContext
        );
        storedRiskAnalysis.forEach((r: { deleted: any }) =>
          expect(r.deleted).toBe(true)
        );
      });
    });

    describe("Document Delete", () => {
      it("should mark a document as deleted", async () => {
        const baseEserviceItem = createBaseEserviceItem();
        baseEserviceItem.descriptorsSQL.push(descriptorSQL);
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([baseEserviceItem], dbContext);

        const docId = generateId();
        const documentSQL = {
          id: docId,
          eserviceId: unsafeBrandId<EServiceId>(eserviceSQL.id),
          metadataVersion: 1,
          descriptorId: descriptorSQL.id,
          name: "Test Document for Deletion",
          contentType: "application/pdf",
          prettyName: "delete.pdf",
          path: "/docs/delete.pdf",
          checksum: "checksum-delete",
          uploadDate: new Date().toISOString(),
        };

        await catalogService.upsertBatchEServiceDocument(
          [documentSQL],
          dbContext
        );
        await catalogService.deleteBatchEServiceDocument([docId], dbContext);

        const storedDocument = await getDocumentFromDb(docId, dbContext);
        expect(storedDocument[0].deleted).toBe(true);
      });
    });

    describe("Interface Delete", () => {
      it("should mark an interface as deleted", async () => {
        const ifaceId = generateId();
        const interfaceSQL = {
          id: ifaceId,
          eserviceId: unsafeBrandId<EServiceId>(eserviceSQL.id),
          metadataVersion: 1,
          descriptorId: descriptorSQL.id,
          name: "Test Interface for Deletion",
          contentType: "application/json",
          prettyName: "interface.json",
          path: "/interfaces/interface.json",
          checksum: "checksum-interface",
          uploadDate: new Date().toISOString(),
        };

        const baseEserviceItem = createBaseEserviceItem();
        baseEserviceItem.descriptorsSQL.push(descriptorSQL);
        baseEserviceItem.interfacesSQL.push(interfaceSQL);
        const catalogService = catalogServiceBuilder(dbContext);
        await catalogService.upsertBatchEservice([baseEserviceItem], dbContext);
        await catalogService.deleteBatchEserviceInterface([ifaceId], dbContext);

        const storedInterface = await getInterfaceFromDb(ifaceId, dbContext);
        expect(storedInterface[0].deleted).toBe(true);
      });
    });
  });
});
