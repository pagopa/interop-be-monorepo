/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockDescriptor,
  getMockDescriptorRejectionReason,
  getMockDocument,
  getMockEService,
  getMockEServiceAttribute,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  attributeKind,
  Descriptor,
  EService,
  EServiceId,
  generateId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  EServiceSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorAttributeSQL,
  EServiceRiskAnalysisSQL,
} from "pagopa-interop-readmodel-models";
import {
  retrieveEserviceInterfacesSQL,
  retrieveEserviceDescriptorsSQL,
  retrieveEServiceSQL,
  retrieveEserviceRejectionReasonsSQL,
  retrieveEserviceDocumentsSQL,
  retrieveEserviceRiskAnalysesSQL,
  retrieveEserviceRiskAnalysisAnswersSQL,
  retrieveEserviceAttributesSQL,
} from "./eserviceTestReadModelService.js";
import {
  generateRiskAnalysisAnswersSQL,
  initMockEService,
  readModelDB,
  readModelService,
  retrieveAllEServiceSQLObjects,
} from "./utils.js";

describe("E-service queries", () => {
  describe("upsertEService", () => {
    it("should add a complete (*all* fields) e-service", async () => {
      const isEServiceComplete = true;
      const mockDescriptor = getMockDescriptor();
      const mockEService: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [mockDescriptor],
        },
        metadata: {
          version: 1,
        },
      };
      const {
        eservice,
        descriptor,
        rejectionReason,
        descriptorInterface,
        document,
        attributes,
        riskAnalyses,
      } = initMockEService(mockEService, mockDescriptor, isEServiceComplete);

      await readModelService.upsertEService(eservice);

      const {
        retrievedEserviceSQL,
        retrievedDescriptorsSQL,
        retrievedRejectionReasonsSQL,
        retrievedDocumentsSQL,
        retrievedInterfacesSQL,
        retrievedAttributesSQL,
        retrievedRiskAnalysesSQL,
        retrievedRiskAnalysisAnswersSQL,
      } = await retrieveAllEServiceSQLObjects(eservice, isEServiceComplete);

      const expectedEserviceSQL: EServiceSQL = {
        name: eservice.data.name,
        description: eservice.data.description,
        id: eservice.data.id,
        metadataVersion: eservice.metadata.version,
        producerId: eservice.data.producerId,
        technology: eservice.data.technology,
        createdAt: eservice.data.createdAt.toISOString(),
        mode: eservice.data.mode,
        isSignalHubEnabled: eservice.data.isSignalHubEnabled!,
        isConsumerDelegable: eservice.data.isConsumerDelegable!,
        isClientAccessDelegable: eservice.data.isClientAccessDelegable!,
      };

      const expectedDescriptorsSQL: EServiceDescriptorSQL[] = [
        {
          id: descriptor.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          version: descriptor.version,
          state: descriptor.state,
          audience: descriptor.audience,
          voucherLifespan: descriptor.voucherLifespan,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: descriptor.dailyCallsTotal,
          createdAt: descriptor.createdAt.toISOString(),
          serverUrls: descriptor.serverUrls,
          agreementApprovalPolicy: descriptor.agreementApprovalPolicy!,
          description: descriptor.description!,
          publishedAt: descriptor.publishedAt!.toISOString(),
          suspendedAt: descriptor.suspendedAt!.toISOString(),
          deprecatedAt: descriptor.deprecatedAt!.toISOString(),
          archivedAt: descriptor.archivedAt!.toISOString(),
        },
      ];
      const expectedRejectionReasonsSQL:
        | EServiceDescriptorRejectionReasonSQL[] = [
        {
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          rejectionReason: rejectionReason!.rejectionReason,
          rejectedAt: rejectionReason!.rejectedAt.toISOString(),
        },
      ];
      const expectedInterfacesSQL: EServiceDescriptorInterfaceSQL[] = [
        {
          id: descriptorInterface!.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          name: descriptorInterface!.name,
          contentType: descriptorInterface!.contentType,
          prettyName: descriptorInterface!.prettyName,
          path: descriptorInterface!.path,
          checksum: descriptorInterface!.checksum,
          uploadDate: descriptorInterface!.uploadDate.toISOString(),
        },
      ];
      const expectedDocumentsSQL: EServiceDescriptorDocumentSQL[] = [
        {
          id: document.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          name: document.name,
          contentType: document.contentType,
          prettyName: document.prettyName,
          path: document.path,
          checksum: document.checksum,
          uploadDate: document.uploadDate.toISOString(),
        },
      ];
      const expectedAttributesSQL: EServiceDescriptorAttributeSQL[] =
        attributes.map((attribute, idx) => ({
          attributeId: attribute.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          explicitAttributeVerification:
            attribute.explicitAttributeVerification,
          kind: attributeKind.certified,
          groupId: idx,
        }));
      const expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] =
        riskAnalyses.map((riskAnalysis) => ({
          id: riskAnalysis.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          name: riskAnalysis.name,
          createdAt: riskAnalysis.createdAt.toISOString(),
          riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
          riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
        }));
      const expectedRiskAnalysisAnswersSQL = generateRiskAnalysisAnswersSQL(
        eservice.data.id,
        riskAnalyses
      );

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
      expect(retrievedDescriptorsSQL).toMatchObject(expectedDescriptorsSQL);
      expect(retrievedRejectionReasonsSQL).toMatchObject(
        expectedRejectionReasonsSQL
      );
      expect(retrievedInterfacesSQL).toMatchObject(expectedInterfacesSQL);
      expect(retrievedDocumentsSQL).toMatchObject(expectedDocumentsSQL);
      expect(retrievedAttributesSQL).toMatchObject(
        expect.arrayContaining(expectedAttributesSQL)
      );
      expect(retrievedRiskAnalysesSQL).toMatchObject(expectedRiskAnalysesSQL);
      expect(retrievedRiskAnalysisAnswersSQL).toMatchObject(
        expectedRiskAnalysisAnswersSQL
      );
    });

    it("should add an incomplete (*only* mandatory fields) e-service", async () => {
      const isEServiceComplete = false;
      const mockDescriptor = getMockDescriptor();
      const mockEService: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [mockDescriptor],
        },
        metadata: {
          version: 1,
        },
      };
      const { eservice, descriptor, document, attributes, riskAnalyses } =
        initMockEService(mockEService, mockDescriptor, isEServiceComplete);

      await readModelService.upsertEService(eservice);

      const {
        retrievedEserviceSQL,
        retrievedDescriptorsSQL,
        retrievedRejectionReasonsSQL,
        retrievedDocumentsSQL,
        retrievedInterfacesSQL,
        retrievedAttributesSQL,
        retrievedRiskAnalysesSQL,
        retrievedRiskAnalysisAnswersSQL,
      } = await retrieveAllEServiceSQLObjects(eservice, isEServiceComplete);

      const expectedEserviceSQL: EServiceSQL = {
        name: eservice.data.name,
        description: eservice.data.description,
        id: eservice.data.id,
        metadataVersion: eservice.metadata.version,
        producerId: eservice.data.producerId,
        technology: eservice.data.technology,
        createdAt: eservice.data.createdAt.toISOString(),
        mode: eservice.data.mode,
        isSignalHubEnabled: null,
        isConsumerDelegable: null,
        isClientAccessDelegable: null,
      };

      const expectedDescriptorsSQL: EServiceDescriptorSQL[] = [
        {
          id: descriptor.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          version: descriptor.version,
          state: descriptor.state,
          audience: descriptor.audience,
          voucherLifespan: descriptor.voucherLifespan,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: descriptor.dailyCallsTotal,
          createdAt: descriptor.createdAt.toISOString(),
          serverUrls: descriptor.serverUrls,
          agreementApprovalPolicy: null,
          description: null,
          publishedAt: null,
          suspendedAt: null,
          deprecatedAt: null,
          archivedAt: null,
        },
      ];
      const expectedDocumentsSQL: EServiceDescriptorDocumentSQL[] = [
        {
          id: document.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          name: document.name,
          contentType: document.contentType,
          prettyName: document.prettyName,
          path: document.path,
          checksum: document.checksum,
          uploadDate: document.uploadDate.toISOString(),
        },
      ];
      const expectedAttributesSQL: EServiceDescriptorAttributeSQL[] =
        attributes.map((attribute, idx) => ({
          attributeId: attribute.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          explicitAttributeVerification:
            attribute.explicitAttributeVerification,
          kind: attributeKind.certified,
          groupId: idx,
        }));
      const expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] =
        riskAnalyses.map((riskAnalysis) => ({
          id: riskAnalysis.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          name: riskAnalysis.name,
          createdAt: riskAnalysis.createdAt.toISOString(),
          riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
          riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
        }));
      const expectedRiskAnalysisAnswersSQL = generateRiskAnalysisAnswersSQL(
        eservice.data.id,
        riskAnalyses
      );

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
      expect(retrievedDescriptorsSQL).toMatchObject(expectedDescriptorsSQL);
      expect(retrievedRejectionReasonsSQL).toBeUndefined();
      expect(retrievedInterfacesSQL).toBeUndefined();
      expect(retrievedDocumentsSQL).toMatchObject(expectedDocumentsSQL);
      expect(retrievedAttributesSQL).toMatchObject(
        expect.arrayContaining(expectedAttributesSQL)
      );
      expect(retrievedRiskAnalysesSQL).toMatchObject(expectedRiskAnalysesSQL);
      expect(retrievedRiskAnalysisAnswersSQL).toMatchObject(
        expectedRiskAnalysisAnswersSQL
      );
    });

    it("should update a complete (*all* fields) e-service", async () => {
      const isEServiceComplete = true;
      const mockDescriptor = getMockDescriptor();
      const mockEService: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [mockDescriptor],
        },
        metadata: {
          version: 1,
        },
      };
      await readModelService.upsertEService(mockEService);

      const {
        eservice,
        descriptor,
        rejectionReason,
        descriptorInterface,
        document,
        attributes,
        riskAnalyses,
      } = initMockEService(mockEService, mockDescriptor, isEServiceComplete);

      await readModelService.upsertEService(eservice);

      const {
        retrievedEserviceSQL,
        retrievedDescriptorsSQL,
        retrievedRejectionReasonsSQL,
        retrievedDocumentsSQL,
        retrievedInterfacesSQL,
        retrievedAttributesSQL,
        retrievedRiskAnalysesSQL,
        retrievedRiskAnalysisAnswersSQL,
      } = await retrieveAllEServiceSQLObjects(eservice, isEServiceComplete);

      const expectedEserviceSQL: EServiceSQL = {
        name: eservice.data.name,
        description: eservice.data.description,
        id: eservice.data.id,
        metadataVersion: eservice.metadata.version,
        producerId: eservice.data.producerId,
        technology: eservice.data.technology,
        createdAt: eservice.data.createdAt.toISOString(),
        mode: eservice.data.mode,
        isSignalHubEnabled: eservice.data.isSignalHubEnabled!,
        isConsumerDelegable: eservice.data.isConsumerDelegable!,
        isClientAccessDelegable: eservice.data.isClientAccessDelegable!,
      };

      const expectedDescriptorsSQL: EServiceDescriptorSQL[] = [
        {
          id: descriptor.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          version: descriptor.version,
          state: descriptor.state,
          audience: descriptor.audience,
          voucherLifespan: descriptor.voucherLifespan,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: descriptor.dailyCallsTotal,
          createdAt: descriptor.createdAt.toISOString(),
          serverUrls: descriptor.serverUrls,
          agreementApprovalPolicy: descriptor.agreementApprovalPolicy!,
          description: descriptor.description!,
          publishedAt: descriptor.publishedAt!.toISOString(),
          suspendedAt: descriptor.suspendedAt!.toISOString(),
          deprecatedAt: descriptor.deprecatedAt!.toISOString(),
          archivedAt: descriptor.archivedAt!.toISOString(),
        },
      ];
      const expectedRejectionReasonsSQL:
        | EServiceDescriptorRejectionReasonSQL[] = [
        {
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          rejectionReason: rejectionReason!.rejectionReason,
          rejectedAt: rejectionReason!.rejectedAt.toISOString(),
        },
      ];
      const expectedInterfacesSQL: EServiceDescriptorInterfaceSQL[] = [
        {
          id: descriptorInterface!.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          name: descriptorInterface!.name,
          contentType: descriptorInterface!.contentType,
          prettyName: descriptorInterface!.prettyName,
          path: descriptorInterface!.path,
          checksum: descriptorInterface!.checksum,
          uploadDate: descriptorInterface!.uploadDate.toISOString(),
        },
      ];
      const expectedDocumentsSQL: EServiceDescriptorDocumentSQL[] = [
        {
          id: document.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          name: document.name,
          contentType: document.contentType,
          prettyName: document.prettyName,
          path: document.path,
          checksum: document.checksum,
          uploadDate: document.uploadDate.toISOString(),
        },
      ];
      const expectedAttributesSQL: EServiceDescriptorAttributeSQL[] =
        attributes.map((attribute, idx) => ({
          attributeId: attribute.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          descriptorId: descriptor.id,
          explicitAttributeVerification:
            attribute.explicitAttributeVerification,
          kind: attributeKind.certified,
          groupId: idx,
        }));
      const expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] =
        riskAnalyses.map((riskAnalysis) => ({
          id: riskAnalysis.id,
          eserviceId: eservice.data.id,
          metadataVersion: eservice.metadata.version,
          name: riskAnalysis.name,
          createdAt: riskAnalysis.createdAt.toISOString(),
          riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
          riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
        }));
      const expectedRiskAnalysisAnswersSQL = generateRiskAnalysisAnswersSQL(
        eservice.data.id,
        riskAnalyses
      );

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
      expect(retrievedDescriptorsSQL).toMatchObject(expectedDescriptorsSQL);
      expect(retrievedRejectionReasonsSQL).toMatchObject(
        expectedRejectionReasonsSQL
      );
      expect(retrievedInterfacesSQL).toMatchObject(expectedInterfacesSQL);
      expect(retrievedDocumentsSQL).toMatchObject(expectedDocumentsSQL);
      expect(retrievedAttributesSQL).toMatchObject(
        expect.arrayContaining(expectedAttributesSQL)
      );
      expect(retrievedRiskAnalysesSQL).toMatchObject(expectedRiskAnalysesSQL);
      expect(retrievedRiskAnalysisAnswersSQL).toMatchObject(
        expectedRiskAnalysisAnswersSQL
      );
    });
  });

  describe("getEServiceById", () => {
    it("eservice found", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: getMockDocument(),
        docs: [getMockDocument()],
        rejectionReasons: [getMockDescriptorRejectionReason()],
      };
      const eservice: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor],
          riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        },
        metadata: { version: 1 },
      };
      await readModelService.upsertEService(eservice);
      const retrievedEService = await readModelService.getEServiceById(
        eservice.data.id
      );

      expect(retrievedEService).toMatchObject(eservice);
    });

    it("eservice NOT found", async () => {
      const eserviceId = generateId<EServiceId>();
      const retrievedEService = await readModelService.getEServiceById(
        eserviceId
      );

      expect(retrievedEService).toBeUndefined();
    });
  });

  describe("getAllEServices", () => {
    it("eservices found", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: getMockDocument(),
        docs: [getMockDocument()],
        rejectionReasons: [getMockDescriptorRejectionReason()],
      };
      const eservice1: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor1],
          riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        },
        metadata: { version: 1 },
      };
      await readModelService.upsertEService(eservice1);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: getMockDocument(),
        docs: [getMockDocument()],
        rejectionReasons: [getMockDescriptorRejectionReason()],
      };
      const eservice2: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor2],
          riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        },
        metadata: { version: 1 },
      };
      await readModelService.upsertEService(eservice2);

      const retrievedEServices = await readModelService.getAllEServices();
      expect(retrievedEServices).toHaveLength(2);
      expect(retrievedEServices).toMatchObject(
        expect.arrayContaining([eservice1, eservice2])
      );
    });

    it("eservices NOT found", async () => {
      const retrievedEServices = await readModelService.getAllEServices();
      expect(retrievedEServices).toHaveLength(0);
    });
  });

  describe("deleteEServiceById", () => {
    it("delete one eservice", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: getMockDocument(),
        docs: [getMockDocument()],
        rejectionReasons: [getMockDescriptorRejectionReason()],
      };
      const eservice: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor],
          riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        },
        metadata: { version: 1 },
      };
      await readModelService.upsertEService(eservice);

      const [
        eserviceSQLBeforeDelete,
        descriptorsSQLBeforeDelete,
        docsSQLBeforeDelete,
        interfacesSQLBeforeDelete,
        attributesSQLBeforeDelete,
        rejectionReasonsSQLBeforeDelete,
        riskAnalysisSQLBeforeDelete,
        riskAnalysisAnswersSQLBeforeDelete,
      ] = await Promise.all([
        retrieveEServiceSQL(eservice.data.id, readModelDB),
        retrieveEserviceDescriptorsSQL(eservice.data.id, readModelDB),
        retrieveEserviceDocumentsSQL(eservice.data.id, readModelDB),
        retrieveEserviceInterfacesSQL(eservice.data.id, readModelDB),
        retrieveEserviceAttributesSQL(eservice.data.id, readModelDB),
        retrieveEserviceRejectionReasonsSQL(eservice.data.id, readModelDB),
        retrieveEserviceRiskAnalysesSQL(eservice.data.id, readModelDB),
        retrieveEserviceRiskAnalysisAnswersSQL(eservice.data.id, readModelDB),
      ]);
      expect(eserviceSQLBeforeDelete).toBeDefined();
      expect(descriptorsSQLBeforeDelete).toBeDefined();
      expect(docsSQLBeforeDelete).toBeDefined();
      expect(interfacesSQLBeforeDelete).toBeDefined();
      expect(attributesSQLBeforeDelete).toBeDefined();
      expect(rejectionReasonsSQLBeforeDelete).toBeDefined();
      expect(riskAnalysisSQLBeforeDelete).toBeDefined();
      expect(riskAnalysisAnswersSQLBeforeDelete).toBeDefined();

      await readModelService.deleteEServiceById(eservice.data.id);

      const [
        eserviceSQL,
        descriptorsSQL,
        docsSQL,
        interfacesSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysisSQL,
        riskAnalysisAnswersSQL,
      ] = await Promise.all([
        retrieveEServiceSQL(eservice.data.id, readModelDB),
        retrieveEserviceDescriptorsSQL(eservice.data.id, readModelDB),
        retrieveEserviceDocumentsSQL(eservice.data.id, readModelDB),
        retrieveEserviceInterfacesSQL(eservice.data.id, readModelDB),
        retrieveEserviceAttributesSQL(eservice.data.id, readModelDB),
        retrieveEserviceRejectionReasonsSQL(eservice.data.id, readModelDB),
        retrieveEserviceRiskAnalysesSQL(eservice.data.id, readModelDB),
        retrieveEserviceRiskAnalysisAnswersSQL(eservice.data.id, readModelDB),
      ]);

      expect(eserviceSQL).toBeUndefined();
      expect(descriptorsSQL).toBeUndefined();
      expect(docsSQL).toBeUndefined();
      expect(interfacesSQL).toBeUndefined();
      expect(attributesSQL).toBeUndefined();
      expect(rejectionReasonsSQL).toBeUndefined();
      expect(riskAnalysisSQL).toBeUndefined();
      expect(riskAnalysisAnswersSQL).toBeUndefined();
    });
  });
});
