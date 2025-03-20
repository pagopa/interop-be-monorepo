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
  EServiceTemplateVersion,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { splitEServiceTemplateIntoObjectsSQL } from "../src/eservice-template/splitters.js";
import { aggregateEServiceTemplate } from "../src/eservice-template/aggregators.js";

describe("E-service template aggregator", () => {
  it("should convert e-service template SQL items into an eservice template", () => {
    const certifiedAttribute = getMockEServiceAttribute();
    const doc = getMockDocument();
    const interfaceDoc = getMockDocument();
    const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
    const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);
    const publishedAt = new Date();
    const suspendedAt = new Date();
    const deprecatedAt = new Date();
    const isSignalHubEnabled = true;

    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [[certifiedAttribute]],
        declared: [],
        verified: [],
      },
      docs: [doc],
      interface: interfaceDoc,
      description: "description test",
      publishedAt,
      suspendedAt,
      deprecatedAt,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 10,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [version],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      isSignalHubEnabled,
    };

    const {
      eserviceTemplateSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
    } = splitEServiceTemplateIntoObjectsSQL(eserviceTemplate, 1);

    const aggregatedEServiceTemplate = aggregateEServiceTemplate({
      eserviceTemplateSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
    });

    expect(aggregatedEServiceTemplate).toStrictEqual({
      data: eserviceTemplate,
      metadata: { version: 1 },
    });
  });

  it("should convert an incomplete eservice items into an eservice(undefined -> null)", () => {
    const eserviceTemplate = getMockEServiceTemplate();

    const {
      eserviceTemplateSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
    } = splitEServiceTemplateIntoObjectsSQL(eserviceTemplate, 1);

    const aggregatedEServiceTemplate = aggregateEServiceTemplate({
      eserviceTemplateSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      versionsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
    });

    expect(aggregatedEServiceTemplate).toStrictEqual({
      data: eserviceTemplate,
      metadata: { version: 1 },
    });
  });
});
