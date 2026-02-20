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
  EServiceTemplateId,
  generateId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { upsertEService } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { catalogReadModelService } from "./eserviceUtils.js";

describe("E-service queries", () => {
  describe("should get an e-service by id", () => {
    it("eservice found", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
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

      const eservice: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor],
          riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
          isSignalHubEnabled: true,
          isConsumerDelegable: true,
          isClientAccessDelegable: true,
          templateId: generateId<EServiceTemplateId>(),
        },
        metadata: {
          version: 1,
        },
      };
      await upsertEService(
        readModelDB,
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
});
