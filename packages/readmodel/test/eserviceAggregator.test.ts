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
  tenantKind,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { splitEserviceIntoObjectsSQL } from "../src/catalog/splitters.js";
import { aggregateEservice } from "../src/catalog/aggregators.js";

describe("E-service aggregator", () => {
  it("should convert eservice SQL items into an eservice", () => {
    const certifiedAttribute = getMockEServiceAttribute();
    const doc = getMockDocument();
    const interfaceDoc = getMockDocument();
    const rejectionReason = getMockDescriptorRejectionReason();
    const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
    const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);
    const publishedAt = new Date();
    const suspendedAt = new Date();
    const deprecatedAt = new Date();
    const archivedAt = new Date();
    const isSignalHubEnabled = true;
    const isClientAccessDelegable = true;
    const isConsumerDelegable = true;

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: [[certifiedAttribute]],
        declared: [],
        verified: [],
      },
      docs: [doc],
      interface: interfaceDoc,
      rejectionReasons: [rejectionReason],
      description: "description test",
      publishedAt,
      suspendedAt,
      deprecatedAt,
      archivedAt,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      isSignalHubEnabled,
      isClientAccessDelegable,
      isConsumerDelegable,
    };

    const {
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateRefSQL,
      templateVersionRefsSQL,
    } = splitEserviceIntoObjectsSQL(eservice, 1);

    const aggregatedEservice = aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateRefSQL,
      templateVersionRefsSQL,
    });

    expect(aggregatedEservice).toStrictEqual({
      data: eservice,
      metadata: { version: 1 },
    });
  });

  it("should convert an incomplete eservice items into an eservice(undefined -> null)", () => {
    const doc = getMockDocument();
    const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
    const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
      docs: [doc],
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };

    const {
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateRefSQL,
      templateVersionRefsSQL,
    } = splitEserviceIntoObjectsSQL(eservice, 1);

    const aggregatedEservice = aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateRefSQL,
      templateVersionRefsSQL,
    });

    expect(aggregatedEservice).toStrictEqual({
      data: eservice,
      metadata: { version: 1 },
    });
  });
});
