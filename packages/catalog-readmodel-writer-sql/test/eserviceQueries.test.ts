/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockDescriptor,
  getMockEServiceAttribute,
  getMockDocument,
  getMockDescriptorRejectionReason,
  getMockEService,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  agreementApprovalPolicy,
  generateId,
  EService,
  tenantKind,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { aggregateEservice } from "pagopa-interop-readmodel";
import { describe, expect, it } from "vitest";
import {
  catalogWriterService,
  checkCompleteEService,
  readModelDB,
  retrieveEserviceDescriptorAttributesSQLById,
  retrieveEserviceDescriptorsSQLById,
  retrieveEserviceDocumentsSQLById,
  retrieveEserviceInterfacesSQLById,
  retrieveEserviceRejectionReasonsSQLById,
  retrieveEserviceRiskAnalysesSQLById,
  retrieveEserviceRiskAnalysisAnswersSQLById,
  retrieveEServiceSQLById,
  retrieveEServiceTemplateVersionRefsSQLById,
} from "./utils.js";

describe("E-service queries", () => {
  describe("should insert or update an e-service", () => {
    it("should add a complete (*all* fields) e-service", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [
            [getMockEServiceAttribute()],
            [getMockEServiceAttribute()],
          ],
          declared: [],
          verified: [],
        },
        docs: [getMockDocument()],
        interface: getMockDocument(),
        rejectionReasons: [getMockDescriptorRejectionReason()],
        description: "description test",
        publishedAt: new Date(),
        suspendedAt: new Date(),
        deprecatedAt: new Date(),
        archivedAt: new Date(),
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        templateVersionRef: {
          id: generateId(),
          interfaceMetadata: {
            contactEmail: "contact email",
            contactName: "contact name",
            contactUrl: "contact url",
            termsAndConditionsUrl: "terms and conditions url",
          },
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PA),
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
        ],
        isSignalHubEnabled: true,
        isConsumerDelegable: true,
        isClientAccessDelegable: true,
        templateId: generateId<EServiceTemplateId>(),
        personalData: true,
      };

      await catalogWriterService.upsertEService(eservice, 1);

      const {
        eserviceSQL,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        templateVersionRefsSQL,
      } = await checkCompleteEService(eservice);

      const retrievedEService = aggregateEservice({
        eserviceSQL,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        templateVersionRefsSQL,
      });

      expect(retrievedEService).toStrictEqual({
        data: eservice,
        metadata: {
          version: 1,
        },
      });
    });

    it("should add an incomplete (*only* mandatory fields) e-service", async () => {
      const eservice = getMockEService();

      await catalogWriterService.upsertEService(eservice, 1);

      const eserviceSQL = await retrieveEServiceSQLById(
        eservice.id,
        readModelDB
      );
      const descriptorsSQL = await retrieveEserviceDescriptorsSQLById(
        eservice.id,
        readModelDB
      );
      const interfacesSQL = await retrieveEserviceInterfacesSQLById(
        eservice.id,
        readModelDB
      );
      const documentsSQL = await retrieveEserviceDocumentsSQLById(
        eservice.id,
        readModelDB
      );
      const attributesSQL = await retrieveEserviceDescriptorAttributesSQLById(
        eservice.id,
        readModelDB
      );
      const rejectionReasonsSQL = await retrieveEserviceRejectionReasonsSQLById(
        eservice.id,
        readModelDB
      );
      const riskAnalysesSQL = await retrieveEserviceRiskAnalysesSQLById(
        eservice.id,
        readModelDB
      );
      const riskAnalysisAnswersSQL =
        await retrieveEserviceRiskAnalysisAnswersSQLById(
          eservice.id,
          readModelDB
        );
      const templateVersionRefsSQL =
        await retrieveEServiceTemplateVersionRefsSQLById(
          eservice.id,
          readModelDB
        );

      expect(eserviceSQL).toBeDefined();
      expect(descriptorsSQL).toHaveLength(0);
      expect(interfacesSQL).toHaveLength(0);
      expect(documentsSQL).toHaveLength(0);
      expect(attributesSQL).toHaveLength(0);
      expect(rejectionReasonsSQL).toHaveLength(0);
      expect(riskAnalysesSQL).toHaveLength(0);
      expect(riskAnalysisAnswersSQL).toHaveLength(0);

      const retrievedEService = aggregateEservice({
        eserviceSQL: eserviceSQL!,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        templateVersionRefsSQL,
      });

      expect(retrievedEService).toStrictEqual({
        data: eservice,
        metadata: {
          version: 1,
        },
      });
    });

    it("should update a complete (*all* fields) e-service", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [
            [getMockEServiceAttribute()],
            [getMockEServiceAttribute()],
          ],
          declared: [],
          verified: [],
        },
        docs: [getMockDocument()],
        interface: getMockDocument(),
        rejectionReasons: [getMockDescriptorRejectionReason()],
        description: "description test",
        publishedAt: new Date(),
        suspendedAt: new Date(),
        deprecatedAt: new Date(),
        archivedAt: new Date(),
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        templateVersionRef: {
          id: generateId(),
          interfaceMetadata: {
            contactEmail: "contact email",
            contactName: "contact name",
            contactUrl: "contact url",
            termsAndConditionsUrl: "terms and conditions url",
          },
        },
      };

      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PA),
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
        ],
        isSignalHubEnabled: true,
        isConsumerDelegable: true,
        isClientAccessDelegable: true,
        templateId: generateId<EServiceTemplateId>(),
        personalData: true,
      };

      await catalogWriterService.upsertEService(eservice, 1);
      await catalogWriterService.upsertEService(eservice, 2);

      const {
        eserviceSQL,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        templateVersionRefsSQL,
      } = await checkCompleteEService(eservice);

      const retrievedEService = aggregateEservice({
        eserviceSQL,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        templateVersionRefsSQL,
      });

      expect(retrievedEService).toStrictEqual({
        data: eservice,
        metadata: {
          version: 2,
        },
      });
    });
  });

  describe("should delete an e-service by id", () => {
    it("delete one eservice", async () => {
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [
          {
            ...getMockDescriptor(),
            attributes: {
              certified: [[getMockEServiceAttribute()]],
              declared: [],
              verified: [],
            },
            interface: getMockDocument(),
            docs: [getMockDocument()],
            rejectionReasons: [getMockDescriptorRejectionReason()],
            templateVersionRef: {
              id: generateId(),
              interfaceMetadata: {
                contactEmail: "contact email",
                contactName: "contact name",
                contactUrl: "contact url",
                termsAndConditionsUrl: "terms and conditions url",
              },
            },
          },
        ],
        riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        templateId: generateId<EServiceTemplateId>(),
      };
      await catalogWriterService.upsertEService(eservice1, 1);
      await checkCompleteEService(eservice1);

      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [
          {
            ...getMockDescriptor(),
            attributes: {
              certified: [[getMockEServiceAttribute()]],
              declared: [],
              verified: [],
            },
            interface: getMockDocument(),
            docs: [getMockDocument()],
            rejectionReasons: [getMockDescriptorRejectionReason()],
            templateVersionRef: {
              id: generateId(),
              interfaceMetadata: {
                contactEmail: "contact email",
                contactName: "contact name",
                contactUrl: "contact url",
                termsAndConditionsUrl: "terms and conditions url",
              },
            },
          },
        ],
        riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        templateId: generateId<EServiceTemplateId>(),
      };
      await catalogWriterService.upsertEService(eservice2, 1);
      await checkCompleteEService(eservice2);

      await catalogWriterService.deleteEServiceById(eservice1.id, 2);

      expect(
        await retrieveEServiceSQLById(eservice1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrieveEserviceDescriptorsSQLById(eservice1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrieveEserviceInterfacesSQLById(eservice1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrieveEserviceDocumentsSQLById(eservice1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrieveEserviceDescriptorAttributesSQLById(
          eservice1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveEserviceRejectionReasonsSQLById(eservice1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrieveEserviceRiskAnalysesSQLById(eservice1.id, readModelDB)
      ).toHaveLength(0);
      expect(
        await retrieveEserviceRiskAnalysisAnswersSQLById(
          eservice1.id,
          readModelDB
        )
      ).toHaveLength(0);

      await checkCompleteEService(eservice2);
    });
  });
});
