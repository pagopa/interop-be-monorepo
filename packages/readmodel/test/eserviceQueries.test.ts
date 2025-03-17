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
  agreementApprovalPolicy,
  Descriptor,
  EService,
  EServiceId,
  generateId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { aggregateEservice } from "../src/catalog/aggregators.js";
import {
  retrieveEserviceInterfacesSQLById,
  retrieveEserviceDescriptorsSQLById,
  retrieveEServiceSQLById,
  retrieveEserviceRejectionReasonsSQLById,
  retrieveEserviceDocumentsSQLById,
  retrieveEserviceRiskAnalysesSQLById,
  retrieveEserviceRiskAnalysisAnswersSQLById,
  retrieveEserviceDescriptorAttributesSQLById,
  catalogReadModelService,
  checkCompleteEService,
} from "./eserviceUtils.js";
import { readModelDB } from "./utils.js";

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
      };

      await catalogReadModelService.upsertEService(eservice, 1);

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

      await checkCompleteEService(eservice);

      const retrievedEService = aggregateEservice({
        eserviceSQL: eserviceSQL!,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
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

      await catalogReadModelService.upsertEService(eservice, 1);

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
      };

      await catalogReadModelService.upsertEService(eservice, 1);
      await catalogReadModelService.upsertEService(eservice, 2);

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

      await checkCompleteEService(eservice);

      const retrievedEService = aggregateEservice({
        eserviceSQL: eserviceSQL!,
        descriptorsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
      });

      expect(retrievedEService).toStrictEqual({
        data: eservice,
        metadata: {
          version: 2,
        },
      });
    });
  });

  describe("should get an e-service by id", () => {
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

      expect(retrievedEService).toStrictEqual(eservice);
    });

    it("eservice NOT found", async () => {
      const eserviceId = generateId<EServiceId>();
      const retrievedEService = await catalogReadModelService.getEServiceById(
        eserviceId
      );

      expect(retrievedEService).toBeUndefined();
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
          },
        ],
        riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
      };
      await catalogReadModelService.upsertEService(eservice1, 1);
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
          },
        ],
        riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
      };
      await catalogReadModelService.upsertEService(eservice2, 1);
      await checkCompleteEService(eservice2);

      await catalogReadModelService.deleteEServiceById(eservice1.id, 2);

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
