/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, beforeEach, expect } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { catalogServiceBuilder } from "../src/service/catalogService.js";
import {
  dbContext,
  getEserviceFromDb,
  getDescriptorFromDb,
  getDocumentFromDb,
  getInterfaceFromDb,
  getRiskAnalysisFromDb,
} from "./utils.js";
import { CatalogDbTable } from "../src/model/db.js";

describe("Catalog Service - Batch Operations", () => {
  beforeEach(async () => {
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

  it("upsertBatchEservice - successfully inserts and merges an eService", async () => {
    const serviceId = generateId();
    const eserviceSQL = {
      id: unsafeBrandId<EServiceId>(serviceId),
      metadataVersion: 1,
      producerId: generateId(),
      name: "Test E-Service",
      description: "Test e-service",
      technology: "REST",
      createdAt: new Date().toISOString(),
      mode: "active",
      isSignalHubEnabled: true,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
    };

    const eserviceItem = {
      eserviceSQL,
      templateRefSQL: [],
      riskAnalysesSQL: [],
      riskAnalysisAnswersSQL: [],
      descriptorsSQL: [],
      attributesSQL: [],
      interfacesSQL: [],
      documentsSQL: [],
      rejectionReasonsSQL: [],
      templateVersionRefsSQL: [],
    } as any;

    const catalogService = catalogServiceBuilder(dbContext);
    await catalogService.upsertBatchEservice([eserviceItem], dbContext);

    const stored = await getEserviceFromDb(serviceId, dbContext);
    expect(stored).toBeDefined();
    expect(stored?.id).toBe(serviceId);
    expect(stored?.metadata_version).toBe(1);
  });

  it("deleteBatchEService - flags an eService as deleted", async () => {
    const serviceId = generateId();
    const eserviceSQL = {
      id: unsafeBrandId<EServiceId>(serviceId),
      metadataVersion: 1,
      producerId: generateId(),
      name: "E-Service to Delete",
      description: "E-service flagged for deletion",
      technology: "SOAP",
      createdAt: new Date().toISOString(),
      mode: "active",
      isSignalHubEnabled: false,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
    };

    const eserviceItem = {
      eserviceSQL,
      templateRefSQL: [],
      riskAnalysesSQL: [],
      riskAnalysisAnswersSQL: [],
      descriptorsSQL: [],
      attributesSQL: [],
      interfacesSQL: [],
      documentsSQL: [],
      rejectionReasonsSQL: [],
      templateVersionRefsSQL: [],
    } as any;

    const catalogService = catalogServiceBuilder(dbContext);
    await catalogService.upsertBatchEservice([eserviceItem], dbContext);
    let stored = await getEserviceFromDb(serviceId, dbContext);
    expect(stored).toBeDefined();

    await catalogService.deleteBatchEService([serviceId], dbContext);
    stored = await getEserviceFromDb(serviceId, dbContext);
    expect(stored?.deleted).toBe(true);
  });

  it("upsertBatchEServiceDescriptor - successfully inserts and merges a descriptor", async () => {
    const serviceId = generateId();
    const descriptorId = generateId();
    const descriptorData = {
      id: unsafeBrandId<DescriptorId>(descriptorId),
      eserviceId: unsafeBrandId<EServiceId>(serviceId),
      metadataVersion: 1,
      version: "v1",
      description: "Test Descriptor",
      state: "Published",
      audience: ["IT", "Health"],
      docs: [],
      attributes: { declared: [], verified: [], certified: [] },
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

    const descriptorItem = {
      descriptorData,
      eserviceId: unsafeBrandId<EServiceId>(serviceId),
      metadataVersion: 1,
    };

    const catalogService = catalogServiceBuilder(dbContext);
    await catalogService.upsertBatchEServiceDescriptor(
      [descriptorItem],
      dbContext,
    );

    const stored = await getDescriptorFromDb(descriptorId, dbContext);
    expect(stored).toBeDefined();
    expect(stored?.id).toBe(descriptorId);
    expect(stored?.state).toBe("Published");
  });

  //   it("deleteBatchDescriptor - flags a descriptor as deleted", async () => {
  //     const serviceId = generateId();
  //     const descriptorId = generateId();
  //     const descriptorData = {
  //       id: descriptorId,
  //       eserviceId: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       version: "v1",
  //       description: "Descriptor to Delete",
  //       state: "Published",
  //       audience: ["IT"],
  //       docs: [],
  //       attributes: {},
  //       voucherLifespan: 3600,
  //       dailyCallsPerConsumer: 50,
  //       dailyCallsTotal: 500,
  //       agreementApprovalPolicy: "Automatic",
  //       createdAt: new Date().toISOString(),
  //       serverUrls: ["https://api.example.com"],
  //       publishedAt: new Date().toISOString(),
  //       suspendedAt: null,
  //       deprecatedAt: null,
  //       archivedAt: null,
  //     };

  //     const descriptorItem = {
  //       descriptorData,
  //       eserviceId: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //     };

  //     const catalogService = catalogServiceBuilder(dbContext);
  //     await catalogService.upsertBatchEServiceDescriptor(
  //       [descriptorItem],
  //       dbContext,
  //     );
  //     let stored = await getDescriptorFromDb(descriptorId, dbContext);
  //     expect(stored).toBeDefined();

  //     await catalogService.deleteBatchDescriptor([descriptorId], dbContext);
  //     stored = await getDescriptorFromDb(descriptorId, dbContext);
  //     expect(stored?.deleted).toBe(true);
  //   });

  //   it("upsertBatchEServiceDocument - successfully inserts and merges a document", async () => {
  //     // Ensure the referenced eService exists by inserting it first.
  //     const serviceId = generateId();
  //     const eserviceSQL = {
  //       id: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       producerId: generateId(),
  //       name: "E-Service for Documents",
  //       description: "Test eService",
  //       technology: "REST",
  //       createdAt: new Date().toISOString(),
  //       mode: "active",
  //       isSignalHubEnabled: true,
  //       isConsumerDelegable: false,
  //       isClientAccessDelegable: false,
  //     };
  //     const eserviceItem = {
  //       eserviceSQL,
  //       templateRefSQL: [],
  //       riskAnalysesSQL: [],
  //       riskAnalysisAnswersSQL: [],
  //       descriptorsSQL: [],
  //       attributesSQL: [],
  //       interfacesSQL: [],
  //       documentsSQL: [],
  //       rejectionReasonsSQL: [],
  //       templateVersionRefsSQL: [],
  //     } as any;
  //     const catalogService = catalogServiceBuilder(dbContext);
  //     await catalogService.upsertBatchEservice([eserviceItem], dbContext);

  //     const documentId = generateId();
  //     const documentSQL = {
  //       id: documentId,
  //       eserviceId: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       descriptorId: generateId(), // ensure descriptor exists if needed or adjust FKs accordingly
  //       name: "Test Document",
  //       contentType: "application/pdf",
  //       prettyName: "document.pdf",
  //       path: "/docs/document.pdf",
  //       checksum: "abc123",
  //       uploadDate: new Date().toISOString(),
  //     };

  //     await catalogService.upsertBatchEServiceDocument([documentSQL], dbContext);

  //     const stored = await getDocumentFromDb(documentId, dbContext);
  //     expect(stored).toBeDefined();
  //     expect(stored?.name).toBe("Test Document");
  //   });

  //   it("deleteBatchEServiceDocument - flags a document as deleted", async () => {
  //     // Insert an eService to satisfy FK constraint.
  //     const serviceId = generateId();
  //     const eserviceSQL = {
  //       id: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       producerId: generateId(),
  //       name: "E-Service for Document Deletion",
  //       description: "Test eService",
  //       technology: "REST",
  //       createdAt: new Date().toISOString(),
  //       mode: "active",
  //       isSignalHubEnabled: true,
  //       isConsumerDelegable: false,
  //       isClientAccessDelegable: false,
  //     };
  //     const eserviceItem = {
  //       eserviceSQL,
  //       templateRefSQL: [],
  //       riskAnalysesSQL: [],
  //       riskAnalysisAnswersSQL: [],
  //       descriptorsSQL: [],
  //       attributesSQL: [],
  //       interfacesSQL: [],
  //       documentsSQL: [],
  //       rejectionReasonsSQL: [],
  //       templateVersionRefsSQL: [],
  //     } as any;
  //     const catalogService = catalogServiceBuilder(dbContext);
  //     await catalogService.upsertBatchEservice([eserviceItem], dbContext);

  //     const documentId = generateId();
  //     const documentSQL = {
  //       id: documentId,
  //       eserviceId: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       descriptorId: generateId(),
  //       name: "Document to Delete",
  //       contentType: "application/pdf",
  //       prettyName: "delete.pdf",
  //       path: "/docs/delete.pdf",
  //       checksum: "def456",
  //       uploadDate: new Date().toISOString(),
  //     };

  //     await catalogService.upsertBatchEServiceDocument([documentSQL], dbContext);
  //     let stored = await getDocumentFromDb(documentId, dbContext);
  //     expect(stored).toBeDefined();

  //     await catalogService.deleteBatchEServiceDocument([documentId], dbContext);
  //     stored = await getDocumentFromDb(documentId, dbContext);
  //     expect(stored?.deleted).toBe(true);
  //   });

  //   it("deleteBatchEserviceInterface - flags an interface as deleted", async () => {
  //     // Insert an eService so that the FK constraint on the interface is met.
  //     const serviceId = generateId();
  //     const eserviceSQL = {
  //       id: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       producerId: generateId(),
  //       name: "E-Service for Interfaces",
  //       description: "Test eService",
  //       technology: "REST",
  //       createdAt: new Date().toISOString(),
  //       mode: "active",
  //       isSignalHubEnabled: true,
  //       isConsumerDelegable: false,
  //       isClientAccessDelegable: false,
  //     };
  //     const eserviceItem = {
  //       eserviceSQL,
  //       templateRefSQL: [],
  //       riskAnalysesSQL: [],
  //       riskAnalysisAnswersSQL: [],
  //       descriptorsSQL: [],
  //       attributesSQL: [],
  //       interfacesSQL: [],
  //       documentsSQL: [],
  //       rejectionReasonsSQL: [],
  //       templateVersionRefsSQL: [],
  //     } as any;
  //     const catalogService = catalogServiceBuilder(dbContext);
  //     await catalogService.upsertBatchEservice([eserviceItem], dbContext);

  //     const interfaceId = generateId();
  //     const interfaceSQL = {
  //       id: interfaceId,
  //       eserviceId: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       descriptorId: generateId(),
  //       name: "Test Interface",
  //       contentType: "application/json",
  //       prettyName: "interface.json",
  //       path: "/interfaces/interface.json",
  //       checksum: "ghi789",
  //       uploadDate: new Date().toISOString(),
  //     };

  //     const eserviceItemWithInterface = {
  //       eserviceSQL: {
  //         id: unsafeBrandId<EServiceId>(serviceId),
  //         metadataVersion: 1,
  //         producerId: generateId(),
  //         name: "E-Service for Interfaces",
  //         description: "Test interfaces",
  //         technology: "REST",
  //         createdAt: new Date().toISOString(),
  //         mode: "active",
  //         isSignalHubEnabled: true,
  //         isConsumerDelegable: false,
  //         isClientAccessDelegable: false,
  //       },
  //       templateRefSQL: [],
  //       riskAnalysesSQL: [],
  //       riskAnalysisAnswersSQL: [],
  //       descriptorsSQL: [],
  //       attributesSQL: [],
  //       interfacesSQL: [interfaceSQL],
  //       documentsSQL: [],
  //       rejectionReasonsSQL: [],
  //       templateVersionRefsSQL: [],
  //     } as any;

  //     await catalogService.upsertBatchEservice(
  //       [eserviceItemWithInterface],
  //       dbContext,
  //     );
  //     let storedInterface = await getInterfaceFromDb(interfaceId, dbContext);
  //     expect(storedInterface).toBeDefined();

  //     await catalogService.deleteBatchEserviceInterface([interfaceId], dbContext);
  //     storedInterface = await getInterfaceFromDb(interfaceId, dbContext);
  //     expect(storedInterface?.deleted).toBe(true);
  //   });

  //   it("deleteBatchEserviceRiskAnalysis - flags a risk analysis as deleted and merges deletion for answers", async () => {
  //     // Insert an eService first.
  //     const serviceId = generateId();
  //     const eserviceSQL = {
  //       id: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       producerId: generateId(),
  //       name: "E-Service for Risk Analysis",
  //       description: "Test risk analysis",
  //       technology: "REST",
  //       createdAt: new Date().toISOString(),
  //       mode: "active",
  //       isSignalHubEnabled: true,
  //       isConsumerDelegable: false,
  //       isClientAccessDelegable: false,
  //     };
  //     const eserviceItem = {
  //       eserviceSQL,
  //       templateRefSQL: [],
  //       riskAnalysesSQL: [],
  //       riskAnalysisAnswersSQL: [],
  //       descriptorsSQL: [],
  //       attributesSQL: [],
  //       interfacesSQL: [],
  //       documentsSQL: [],
  //       rejectionReasonsSQL: [],
  //       templateVersionRefsSQL: [],
  //     } as any;
  //     const catalogService = catalogServiceBuilder(dbContext);
  //     await catalogService.upsertBatchEservice([eserviceItem], dbContext);

  //     const riskAnalysisId = generateId();
  //     const riskAnalysisSQL = {
  //       id: riskAnalysisId,
  //       eserviceId: unsafeBrandId<EServiceId>(serviceId),
  //       metadataVersion: 1,
  //       name: "Test Risk Analysis",
  //       createdAt: new Date().toISOString(),
  //       riskAnalysisFormId: generateId(),
  //       riskAnalysisFormVersion: "1.0",
  //     };

  //     const eserviceItemWithRiskAnalysis = {
  //       eserviceSQL: {
  //         id: unsafeBrandId<EServiceId>(serviceId),
  //         metadataVersion: 1,
  //         producerId: generateId(),
  //         name: "E-Service for Risk Analysis",
  //         description: "Test risk analysis",
  //         technology: "REST",
  //         createdAt: new Date().toISOString(),
  //         mode: "active",
  //         isSignalHubEnabled: true,
  //         isConsumerDelegable: false,
  //         isClientAccessDelegable: false,
  //       },
  //       templateRefSQL: [],
  //       riskAnalysisSQL: [riskAnalysisSQL],
  //       riskAnalysisAnswersSQL: [],
  //       descriptorsSQL: [],
  //       attributesSQL: [],
  //       interfacesSQL: [],
  //       documentsSQL: [],
  //       rejectionReasonsSQL: [],
  //       templateVersionRefsSQL: [],
  //     } as any;

  //     await catalogService.upsertBatchEservice(
  //       [eserviceItemWithRiskAnalysis],
  //       dbContext,
  //     );
  //     let storedRiskAnalysis = await getRiskAnalysisFromDb(
  //       riskAnalysisId,
  //       dbContext,
  //     );
  //     expect(storedRiskAnalysis).toBeDefined();

  //     await catalogService.deleteBatchEserviceRiskAnalysis(
  //       [riskAnalysisId],
  //       dbContext,
  //     );
  //     storedRiskAnalysis = await getRiskAnalysisFromDb(riskAnalysisId, dbContext);
  //     expect(storedRiskAnalysis?.deleted).toBe(true);
  //   });
});
