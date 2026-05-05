/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockDocument,
  getMockEServiceTemplateAttribute,
  getMockEServiceTemplate,
  getMockValidEServiceTemplateRiskAnalysis,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  agreementApprovalPolicy,
  EServiceTemplate,
  EServiceTemplateVersion,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { aggregateEServiceTemplate } from "pagopa-interop-readmodel";
import {
  checkCompleteEServiceTemplate,
  eserviceTemplateWriterService,
  readModelDB,
  retrieveEServiceTemplateRiskAnalysesSQLById,
  retrieveEServiceTemplateRiskAnalysisAnswersSQLById,
  retrieveEServiceTemplateSQLById,
  retrieveEServiceTemplateVersionAttributesSQLById,
  retrieveEServiceTemplateVersionDocumentsSQLById,
  retrieveEServiceTemplateVersionInterfacesSQLById,
  retrieveEServiceTemplateVersionsSQLById,
} from "./utils.js";

describe("E-service template queries", () => {
  describe("should insert or update an e-service template", () => {
    it("should add a complete (*all* fields) e-service template", async () => {
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        attributes: {
          certified: [
            [getMockEServiceTemplateAttribute()],
            [getMockEServiceTemplateAttribute()],
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
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PRIVATE),
        ],
        isSignalHubEnabled: true,
        personalData: false,
      };

      await eserviceTemplateWriterService.upsertEServiceTemplate(
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

      await eserviceTemplateWriterService.upsertEServiceTemplate(
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
            [getMockEServiceTemplateAttribute()],
            [getMockEServiceTemplateAttribute()],
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
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PRIVATE),
        ],
        isSignalHubEnabled: true,
        personalData: false,
      };

      await eserviceTemplateWriterService.upsertEServiceTemplate(
        eserviceTemplate,
        1
      );
      await eserviceTemplateWriterService.upsertEServiceTemplate(
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

  describe("should delete an e-service by id", () => {
    it("delete one eservice", async () => {
      const eserviceTemplate1: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [
          {
            ...getMockEServiceTemplateVersion(),
            attributes: {
              certified: [[getMockEServiceTemplateAttribute()]],
              declared: [],
              verified: [],
            },
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
        riskAnalysis: [getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)],
      };
      await eserviceTemplateWriterService.upsertEServiceTemplate(
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
              certified: [[getMockEServiceTemplateAttribute()]],
              declared: [],
              verified: [],
            },
            interface: getMockDocument(),
            docs: [getMockDocument()],
          },
        ],
        riskAnalysis: [getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)],
      };
      await eserviceTemplateWriterService.upsertEServiceTemplate(
        eserviceTemplate2,
        1
      );
      await checkCompleteEServiceTemplate(eserviceTemplate2);

      await eserviceTemplateWriterService.deleteEServiceTemplateById(
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
