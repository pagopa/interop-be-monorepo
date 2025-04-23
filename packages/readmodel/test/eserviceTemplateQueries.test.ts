/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  getMockDocument,
  getMockEServiceAttribute,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  agreementApprovalPolicy,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  generateId,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { aggregateEServiceTemplate } from "../src/eservice-template/aggregators.js";
import {
  eserviceTemplateReadModelService,
  checkCompleteEServiceTemplate,
  retrieveEServiceTemplateSQLById,
  retrieveEServiceTemplateVersionsSQLById,
  retrieveEServiceTemplateRiskAnalysisAnswersSQLById,
  retrieveEServiceTemplateRiskAnalysesSQLById,
  retrieveEServiceTemplateVersionAttributesSQLById,
  retrieveEServiceTemplateVersionDocumentsSQLById,
  retrieveEServiceTemplateVersionInterfacesSQLById,
} from "./eserviceTemplateUtils.js";
import { readModelDB } from "./utils.js";

describe("E-service template queries", () => {
  describe("should insert or update an e-service template", () => {
    it("should add a complete (*all* fields) e-service template", async () => {
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
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
        description: "description test",
        publishedAt: new Date(),
        suspendedAt: new Date(),
        deprecatedAt: new Date(),
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        dailyCallsPerConsumer: 1,
        dailyCallsTotal: 10,
      };

      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [version],
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PA),
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
        ],
        isSignalHubEnabled: true,
      };

      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate,
        1
      );

      const {
        eserviceTemplateSQL,
        versionsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
      } = await checkCompleteEServiceTemplate(eserviceTemplate);

      const retrievedEServiceTemplate = aggregateEServiceTemplate({
        eserviceTemplateSQL,
        versionsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
      });

      expect(retrievedEServiceTemplate).toStrictEqual({
        data: eserviceTemplate,
        metadata: {
          version: 1,
        },
      });
    });

    it("should add an incomplete (*only* mandatory fields) e-service template", async () => {
      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [],
      };

      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate,
        1
      );

      const eserviceTemplateSQL = await retrieveEServiceTemplateSQLById(
        eserviceTemplate.id,
        readModelDB
      );
      const versionsSQL = await retrieveEServiceTemplateVersionsSQLById(
        eserviceTemplate.id,
        readModelDB
      );
      const interfacesSQL =
        await retrieveEServiceTemplateVersionInterfacesSQLById(
          eserviceTemplate.id,
          readModelDB
        );
      const documentsSQL =
        await retrieveEServiceTemplateVersionDocumentsSQLById(
          eserviceTemplate.id,
          readModelDB
        );
      const attributesSQL =
        await retrieveEServiceTemplateVersionAttributesSQLById(
          eserviceTemplate.id,
          readModelDB
        );
      const riskAnalysesSQL = await retrieveEServiceTemplateRiskAnalysesSQLById(
        eserviceTemplate.id,
        readModelDB
      );
      const riskAnalysisAnswersSQL =
        await retrieveEServiceTemplateRiskAnalysisAnswersSQLById(
          eserviceTemplate.id,
          readModelDB
        );

      expect(eserviceTemplate).toBeDefined();
      expect(versionsSQL).toHaveLength(0);
      expect(interfacesSQL).toHaveLength(0);
      expect(documentsSQL).toHaveLength(0);
      expect(attributesSQL).toHaveLength(0);
      expect(riskAnalysesSQL).toHaveLength(0);
      expect(riskAnalysisAnswersSQL).toHaveLength(0);

      const retrievedEServiceTemplate = aggregateEServiceTemplate({
        eserviceTemplateSQL: eserviceTemplateSQL!,
        versionsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
      });

      expect(retrievedEServiceTemplate).toStrictEqual({
        data: eserviceTemplate,
        metadata: {
          version: 1,
        },
      });
    });

    it("should update a complete (*all* fields) e-service template", async () => {
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
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
        description: "description test",
        publishedAt: new Date(),
        suspendedAt: new Date(),
        deprecatedAt: new Date(),
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        dailyCallsPerConsumer: 1,
        dailyCallsTotal: 10,
      };

      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [version],
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PA),
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
        ],
        isSignalHubEnabled: true,
      };

      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate,
        1
      );
      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate,
        2
      );

      const {
        eserviceTemplateSQL,
        versionsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
      } = await checkCompleteEServiceTemplate(eserviceTemplate);

      const retrievedEServiceTemplate = aggregateEServiceTemplate({
        eserviceTemplateSQL,
        versionsSQL,
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
      });

      expect(retrievedEServiceTemplate).toStrictEqual({
        data: eserviceTemplate,
        metadata: {
          version: 2,
        },
      });
    });
  });

  describe("should get an e-service template by id", () => {
    it("eservice template found", async () => {
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
          riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
        },
        metadata: { version: 1 },
      };
      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate.data,
        eserviceTemplate.metadata.version
      );
      const retrievedEServiceTemplate =
        await eserviceTemplateReadModelService.getEServiceTemplateById(
          eserviceTemplate.data.id
        );

      expect(retrievedEServiceTemplate).toStrictEqual(eserviceTemplate);
    });

    it("eservice NOT found", async () => {
      const eserviceTemplateId = generateId<EServiceTemplateId>();
      const retrievedEServiceTemplate =
        await eserviceTemplateReadModelService.getEServiceTemplateById(
          eserviceTemplateId
        );

      expect(retrievedEServiceTemplate).toBeUndefined();
    });
  });

  describe("should delete an e-service by id", () => {
    it("delete one eservice", async () => {
      const eserviceTemplate1: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [
          {
            ...getMockEServiceTemplateVersion(),
            attributes: {
              certified: [[getMockEServiceAttribute()]],
              declared: [],
              verified: [],
            },
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
        riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
      };
      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate1,
        1
      );
      await checkCompleteEServiceTemplate(eserviceTemplate1);

      const eserviceTemplate2: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [
          {
            ...getMockEServiceTemplateVersion(),
            attributes: {
              certified: [[getMockEServiceAttribute()]],
              declared: [],
              verified: [],
            },
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
        riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
      };
      await eserviceTemplateReadModelService.upsertEServiceTemplate(
        eserviceTemplate2,
        1
      );
      await checkCompleteEServiceTemplate(eserviceTemplate2);

      await eserviceTemplateReadModelService.deleteEServiceTemplateById(
        eserviceTemplate1.id,
        2
      );

      expect(
        await retrieveEServiceTemplateSQLById(eserviceTemplate1.id, readModelDB)
      ).toBeUndefined();
      expect(
        await retrieveEServiceTemplateVersionsSQLById(
          eserviceTemplate1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveEServiceTemplateVersionInterfacesSQLById(
          eserviceTemplate1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveEServiceTemplateVersionDocumentsSQLById(
          eserviceTemplate1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveEServiceTemplateVersionAttributesSQLById(
          eserviceTemplate1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveEServiceTemplateRiskAnalysesSQLById(
          eserviceTemplate1.id,
          readModelDB
        )
      ).toHaveLength(0);
      expect(
        await retrieveEServiceTemplateRiskAnalysisAnswersSQLById(
          eserviceTemplate1.id,
          readModelDB
        )
      ).toHaveLength(0);

      await checkCompleteEServiceTemplate(eserviceTemplate2);
    });
  });
});
