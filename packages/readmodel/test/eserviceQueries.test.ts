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
  generateCompleteExpectedEServiceSQLObjects,
  generateRiskAnalysisAnswersSQL,
  initMockEService,
  readModelDB,
  catalogReadModelService,
  retrieveEServiceSQLObjects,
} from "./utils.js";

describe("E-service queries", () => {
  describe("upsertEService", () => {
    it("should add a complete (*all* fields) e-service", async () => {
      const isEServiceComplete = true;
      const {
        eservice,
        descriptor,
        rejectionReason,
        descriptorInterface,
        document,
        attributes,
        riskAnalyses,
      } = initMockEService(isEServiceComplete);

      await catalogReadModelService.upsertEService(
        eservice.data,
        eservice.metadata.version
      );

      const {
        retrievedEserviceSQL,
        retrievedDescriptorsSQL,
        retrievedRejectionReasonsSQL,
        retrievedDocumentsSQL,
        retrievedInterfacesSQL,
        retrievedAttributesSQL,
        retrievedRiskAnalysesSQL,
        retrievedRiskAnalysisAnswersSQL,
      } = await retrieveEServiceSQLObjects(eservice, isEServiceComplete);

      const {
        expectedEserviceSQL,
        expectedDescriptorsSQL,
        expectedRejectionReasonsSQL,
        expectedInterfacesSQL,
        expectedDocumentsSQL,
        expectedAttributesSQL,
        expectedRiskAnalysesSQL,
        expectedRiskAnalysisAnswersSQL,
      } = generateCompleteExpectedEServiceSQLObjects({
        eservice,
        descriptor,
        rejectionReason: rejectionReason!,
        descriptorInterface: descriptorInterface!,
        document,
        attributes,
        riskAnalyses,
      });

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
      const { eservice, descriptor, document, attributes, riskAnalyses } =
        initMockEService(isEServiceComplete);

      await catalogReadModelService.upsertEService(
        eservice.data,
        eservice.metadata.version
      );

      const {
        retrievedEserviceSQL,
        retrievedDescriptorsSQL,
        retrievedRejectionReasonsSQL,
        retrievedDocumentsSQL,
        retrievedInterfacesSQL,
        retrievedAttributesSQL,
        retrievedRiskAnalysesSQL,
        retrievedRiskAnalysisAnswersSQL,
      } = await retrieveEServiceSQLObjects(eservice, isEServiceComplete);

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
        riskAnalyses,
        eservice.metadata.version
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

      const {
        eserviceBeforeUpdate,
        eservice,
        descriptor,
        rejectionReason,
        descriptorInterface,
        document,
        attributes,
        riskAnalyses,
      } = initMockEService(isEServiceComplete);

      await catalogReadModelService.upsertEService(
        eserviceBeforeUpdate.data,
        eserviceBeforeUpdate.metadata.version
      );
      await catalogReadModelService.upsertEService(
        eservice.data,
        eservice.metadata.version
      );

      const {
        retrievedEserviceSQL,
        retrievedDescriptorsSQL,
        retrievedRejectionReasonsSQL,
        retrievedDocumentsSQL,
        retrievedInterfacesSQL,
        retrievedAttributesSQL,
        retrievedRiskAnalysesSQL,
        retrievedRiskAnalysisAnswersSQL,
      } = await retrieveEServiceSQLObjects(eservice, isEServiceComplete);

      const {
        expectedEserviceSQL,
        expectedDescriptorsSQL,
        expectedRejectionReasonsSQL,
        expectedInterfacesSQL,
        expectedDocumentsSQL,
        expectedAttributesSQL,
        expectedRiskAnalysesSQL,
        expectedRiskAnalysisAnswersSQL,
      } = generateCompleteExpectedEServiceSQLObjects({
        eservice,
        descriptor,
        rejectionReason: rejectionReason!,
        descriptorInterface: descriptorInterface!,
        document,
        attributes,
        riskAnalyses,
      });

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
      await catalogReadModelService.upsertEService(
        eservice.data,
        eservice.metadata.version
      );
      const retrievedEService = await catalogReadModelService.getEServiceById(
        eservice.data.id
      );

      expect(retrievedEService).toMatchObject(eservice);
    });

    it("eservice NOT found", async () => {
      const eserviceId = generateId<EServiceId>();
      const retrievedEService = await catalogReadModelService.getEServiceById(
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
      await catalogReadModelService.upsertEService(
        eservice1.data,
        eservice1.metadata.version
      );

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
      await catalogReadModelService.upsertEService(
        eservice2.data,
        eservice2.metadata.version
      );

      const retrievedEServices =
        await catalogReadModelService.getAllEServices();
      expect(retrievedEServices).toHaveLength(2);
      // expect(retrievedEServices).toMatchObject(
      //   expect.arrayContaining([eservice1, eservice2])
      // );
    });

    it("eservices NOT found", async () => {
      const retrievedEServices =
        await catalogReadModelService.getAllEServices();
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
      await catalogReadModelService.upsertEService(
        eservice.data,
        eservice.metadata.version
      );

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

      await catalogReadModelService.deleteEServiceById(eservice.data.id);

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
