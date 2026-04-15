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
import { splitEServiceTemplateIntoObjectsSQL } from "../../src/eservice-template/splitters.js";
import { aggregateEServiceTemplate } from "../../src/eservice-template/aggregators.js";

describe("E-service template aggregator", () => {
  it("should convert e-service template SQL items into an eservice template", () => {
    const certifiedAttribute = getMockEServiceTemplateAttribute();
    const doc = getMockDocument();
    const interfaceDoc = getMockDocument();

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
      riskAnalysis: [
        getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
        getMockValidEServiceTemplateRiskAnalysis(tenantKind.PRIVATE),
      ],
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

  it("should convert e-service template SQL items with asyncExchangeCallbackInterface into an eservice template", () => {
    const certifiedAttribute = getMockEServiceAttribute();
    const doc = getMockDocument();
    const interfaceDoc = getMockDocument();
    const callbackInterfaceDoc = getMockDocument();

    const publishedAt = new Date();

    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [[certifiedAttribute]],
        declared: [],
        verified: [],
      },
      docs: [doc],
      interface: interfaceDoc,
      asyncExchangeCallbackInterface: callbackInterfaceDoc,
      description: "description test",
      publishedAt,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 10,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [version],
      riskAnalysis: [getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)],
      isSignalHubEnabled: true,
      asyncExchange: true,
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

  it("should convert e-service template SQL items with only asyncExchange but no callback interface", () => {
    const doc = getMockDocument();
    const interfaceDoc = getMockDocument();

    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
      docs: [doc],
      interface: interfaceDoc,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [version],
      riskAnalysis: [],
      asyncExchange: true,
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
    const doc = getMockDocument();

    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
      docs: [doc],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [version],
      riskAnalysis: [
        getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA),
        getMockValidEServiceTemplateRiskAnalysis(tenantKind.PRIVATE),
      ],
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
});
