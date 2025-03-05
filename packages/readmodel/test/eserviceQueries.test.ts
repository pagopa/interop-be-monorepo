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
  Descriptor,
  EService,
  EServiceId,
  generateId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
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
  generateTestCatalogSQLObjects,
  readModelDB,
  readModelService,
} from "./utils.js";

describe("E-service queries", () => {
  describe("upsertEService", () => {
    it("should add a complete (*all* fields) e-service", async () => {
      const {
        retrieved: {
          retrievedEserviceSQL,
          retrievedDescriptorsSQL,
          retrievedRejectionReasonsSQL,
          retrievedDocumentsSQL,
          retrievedInterfacesSQL,
          retrievedAttributesSQL,
          retrievedRiskAnalysesSQL,
          retrievedRiskAnalysisAnswersSQL,
        },
        expected: {
          expectedEserviceSQL,
          expectedDescriptorsSQL,
          expectedAttributesSQL,
          expectedDocumentsSQL,
          expectedInterfacesSQL,
          expectedRejectionReasonsSQL,
          expectedRiskAnalysesSQL,
          expectedRiskAnalysisAnswersSQL,
        },
      } = await generateTestCatalogSQLObjects(true, false);

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
      expect(retrievedDescriptorsSQL).toMatchObject(expectedDescriptorsSQL);
      expect(retrievedRejectionReasonsSQL).toMatchObject(
        expect.arrayContaining(expectedRejectionReasonsSQL!)
      );
      expect(retrievedInterfacesSQL).toMatchObject(expectedInterfacesSQL!);
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
      const {
        retrieved: {
          retrievedEserviceSQL,
          retrievedDescriptorsSQL,
          retrievedRejectionReasonsSQL,
          retrievedDocumentsSQL,
          retrievedInterfacesSQL,
          retrievedAttributesSQL,
          retrievedRiskAnalysesSQL,
          retrievedRiskAnalysisAnswersSQL,
        },
        expected: {
          expectedEserviceSQL,
          expectedDescriptorsSQL,
          expectedAttributesSQL,
          expectedDocumentsSQL,
          expectedRiskAnalysesSQL,
          expectedRiskAnalysisAnswersSQL,
        },
      } = await generateTestCatalogSQLObjects(false, false);

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
      const {
        retrieved: {
          retrievedEserviceSQL,
          retrievedDescriptorsSQL,
          retrievedRejectionReasonsSQL,
          retrievedDocumentsSQL,
          retrievedInterfacesSQL,
          retrievedAttributesSQL,
          retrievedRiskAnalysesSQL,
          retrievedRiskAnalysisAnswersSQL,
        },
        expected: {
          expectedEserviceSQL,
          expectedDescriptorsSQL,
          expectedAttributesSQL,
          expectedDocumentsSQL,
          expectedInterfacesSQL,
          expectedRejectionReasonsSQL,
          expectedRiskAnalysesSQL,
          expectedRiskAnalysisAnswersSQL,
        },
      } = await generateTestCatalogSQLObjects(true, true);

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
      expect(retrievedDescriptorsSQL).toMatchObject(expectedDescriptorsSQL);
      expect(retrievedRejectionReasonsSQL).toMatchObject(
        expect.arrayContaining(expectedRejectionReasonsSQL!)
      );
      expect(retrievedInterfacesSQL).toMatchObject(expectedInterfacesSQL!);
      expect(retrievedDocumentsSQL).toMatchObject(expectedDocumentsSQL);
      expect(retrievedAttributesSQL).toMatchObject(
        expect.arrayContaining(expectedAttributesSQL)
      );
      expect(retrievedRiskAnalysesSQL).toMatchObject(expectedRiskAnalysesSQL);
      expect(retrievedRiskAnalysisAnswersSQL).toMatchObject(
        expectedRiskAnalysisAnswersSQL
      );
    });

    it("should update an incomplete (*only* mandatory fields) e-service", async () => {
      const {
        retrieved: {
          retrievedEserviceSQL,
          retrievedDescriptorsSQL,
          retrievedRejectionReasonsSQL,
          retrievedDocumentsSQL,
          retrievedInterfacesSQL,
          retrievedAttributesSQL,
          retrievedRiskAnalysesSQL,
          retrievedRiskAnalysisAnswersSQL,
        },
        expected: {
          expectedEserviceSQL,
          expectedDescriptorsSQL,
          expectedAttributesSQL,
          expectedDocumentsSQL,
          expectedRiskAnalysesSQL,
          expectedRiskAnalysisAnswersSQL,
        },
      } = await generateTestCatalogSQLObjects(false, true);

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
