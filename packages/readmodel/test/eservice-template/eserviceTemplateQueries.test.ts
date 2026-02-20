import {
  getMockDocument,
  getMockEServiceAttribute,
  getMockEServiceTemplate,
  getMockValidEServiceTemplateRiskAnalysis,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  generateId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { upsertEServiceTemplate } from "../../src/testUtils.js";
import { eserviceTemplateReadModelService } from "./eserviceTemplateUtils.js";
import { readModelDB } from "../utils.js";

describe("E-service template queries", () => {
  describe("should get an e-service template by id", () => {
    it("e-service template found", async () => {
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: getMockDocument(),
        docs: [getMockDocument()],
      };
      const eserviceTemplate: WithMetadata<EServiceTemplate> = {
        data: {
          ...getMockEServiceTemplate(),
          versions: [version],
          riskAnalysis: [
            getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
          ],
        },
        metadata: { version: 1 },
      };
      await upsertEServiceTemplate(
        readModelDB,
        eserviceTemplate.data,
        eserviceTemplate.metadata.version
      );
      const retrievedEServiceTemplate =
        await eserviceTemplateReadModelService.getEServiceTemplateById(
          eserviceTemplate.data.id
        );

      expect(retrievedEServiceTemplate).toStrictEqual(eserviceTemplate);
    });

    it("e-service template NOT found", async () => {
      const eserviceTemplateId = generateId<EServiceTemplateId>();
      const retrievedEServiceTemplate =
        await eserviceTemplateReadModelService.getEServiceTemplateById(
          eserviceTemplateId
        );

      expect(retrievedEServiceTemplate).toBeUndefined();
    });
  });
});
