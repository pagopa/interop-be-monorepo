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
  attributeKind,
  EServiceTemplate,
  EServiceTemplateVersion,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  EServiceTemplateRiskAnalysisAnswerSQL,
  EServiceTemplateRiskAnalysisSQL,
  EServiceTemplateSQL,
  EServiceTemplateVersionAttributeSQL,
  EServiceTemplateVersionDocumentSQL,
  EServiceTemplateVersionSQL,
} from "pagopa-interop-readmodel-models";
import { splitEServiceTemplateIntoObjectsSQL } from "../src/eservice-template/splitters.js";
import { generateEServiceTemplateRiskAnalysisAnswersSQL } from "./eserviceTemplateUtils.js";

describe("E-service template splitter", () => {
  it("should convert a complete e-service template into e-service template SQL objects", () => {
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

    const expectedEServiceTemplateSQL: EServiceTemplateSQL = {
      id: eserviceTemplate.id,
      metadataVersion: 1,
      name: eserviceTemplate.name,
      intendedTarget: eserviceTemplate.intendedTarget,
      createdAt: eserviceTemplate.createdAt.toISOString(),
      creatorId: eserviceTemplate.creatorId,
      description: eserviceTemplate.description,
      technology: eserviceTemplate.technology,
      mode: eserviceTemplate.mode,
      isSignalHubEnabled,
    };

    const expectedRiskAnalysisSQL1: EServiceTemplateRiskAnalysisSQL = {
      id: riskAnalysis1.id,
      metadataVersion: 1,
      name: riskAnalysis1.name,
      createdAt: riskAnalysis1.createdAt.toISOString(),
      eserviceTemplateId: eserviceTemplate.id,
      riskAnalysisFormId: riskAnalysis1.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis1.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisSQL2: EServiceTemplateRiskAnalysisSQL = {
      id: riskAnalysis2.id,
      metadataVersion: 1,
      name: riskAnalysis2.name,
      createdAt: riskAnalysis2.createdAt.toISOString(),
      eserviceTemplateId: eserviceTemplate.id,
      riskAnalysisFormId: riskAnalysis2.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis2.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[] =
      generateEServiceTemplateRiskAnalysisAnswersSQL(
        eserviceTemplate.id,
        [riskAnalysis1, riskAnalysis2],
        1
      );

    const expectedVersionSQL: EServiceTemplateVersionSQL = {
      metadataVersion: 1,
      createdAt: version.createdAt.toISOString(),
      eserviceTemplateId: eserviceTemplate.id,
      description: "description test",
      publishedAt: publishedAt.toISOString(),
      suspendedAt: suspendedAt.toISOString(),
      deprecatedAt: deprecatedAt.toISOString(),
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      id: version.id,
      version: version.version,
      state: version.state,
      voucherLifespan: version.voucherLifespan,
      dailyCallsPerConsumer: version.dailyCallsPerConsumer!,
      dailyCallsTotal: version.dailyCallsTotal!,
    };

    const expectedAttributeSQL: EServiceTemplateVersionAttributeSQL = {
      metadataVersion: 1,
      eserviceTemplateId: eserviceTemplate.id,
      kind: attributeKind.certified,
      attributeId: certifiedAttribute.id,
      versionId: version.id,
      groupId: 0,
      explicitAttributeVerification:
        certifiedAttribute.explicitAttributeVerification,
    };

    const expectedDocumentSQL: EServiceTemplateVersionDocumentSQL = {
      ...doc,
      metadataVersion: 1,
      eserviceTemplateId: eserviceTemplate.id,
      versionId: version.id,
      uploadDate: doc.uploadDate.toISOString(),
    };

    const expectedInterfaceDocSQL: EServiceTemplateVersionDocumentSQL = {
      ...interfaceDoc,
      metadataVersion: 1,
      eserviceTemplateId: eserviceTemplate.id,
      versionId: version.id,
      uploadDate: interfaceDoc.uploadDate.toISOString(),
    };

    expect(eserviceTemplateSQL).toStrictEqual(expectedEServiceTemplateSQL);
    expect(riskAnalysesSQL).toStrictEqual(
      expect.arrayContaining([
        expectedRiskAnalysisSQL1,
        expectedRiskAnalysisSQL2,
      ])
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expectedRiskAnalysisAnswersSQL
    );
    expect(versionsSQL).toStrictEqual([expectedVersionSQL]);
    expect(attributesSQL).toStrictEqual([expectedAttributeSQL]);
    expect(interfacesSQL).toStrictEqual([expectedInterfaceDocSQL]);
    expect(documentsSQL).toStrictEqual(
      expect.arrayContaining([expectedDocumentSQL])
    );
  });

  it("should convert an incomplete e-service into e-service SQL objects (undefined -> null)", () => {
    const doc = getMockDocument();
    const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
    const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);

    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [[]],
        declared: [],
        verified: [],
      },
      docs: [doc],
      interface: undefined,
      description: undefined,
      publishedAt: undefined,
      suspendedAt: undefined,
      deprecatedAt: undefined,
      agreementApprovalPolicy: undefined,
      dailyCallsPerConsumer: undefined,
      dailyCallsTotal: undefined,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [version],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      isSignalHubEnabled: undefined,
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

    const expectedEServiceTemplateSQL: EServiceTemplateSQL = {
      id: eserviceTemplate.id,
      metadataVersion: 1,
      name: eserviceTemplate.name,
      intendedTarget: eserviceTemplate.intendedTarget,
      createdAt: eserviceTemplate.createdAt.toISOString(),
      creatorId: eserviceTemplate.creatorId,
      description: eserviceTemplate.description,
      technology: eserviceTemplate.technology,
      mode: eserviceTemplate.mode,
      isSignalHubEnabled: null,
    };

    const expectedRiskAnalysisSQL1: EServiceTemplateRiskAnalysisSQL = {
      id: riskAnalysis1.id,
      metadataVersion: 1,
      name: riskAnalysis1.name,
      createdAt: riskAnalysis1.createdAt.toISOString(),
      eserviceTemplateId: eserviceTemplate.id,
      riskAnalysisFormId: riskAnalysis1.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis1.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisSQL2: EServiceTemplateRiskAnalysisSQL = {
      id: riskAnalysis2.id,
      metadataVersion: 1,
      name: riskAnalysis2.name,
      createdAt: riskAnalysis2.createdAt.toISOString(),
      eserviceTemplateId: eserviceTemplate.id,
      riskAnalysisFormId: riskAnalysis2.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis2.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[] =
      generateEServiceTemplateRiskAnalysisAnswersSQL(
        eserviceTemplate.id,
        [riskAnalysis1, riskAnalysis2],
        1
      );

    const expectedEServiceTemplateVersionSQL: EServiceTemplateVersionSQL = {
      metadataVersion: 1,
      createdAt: version.createdAt.toISOString(),
      eserviceTemplateId: eserviceTemplate.id,
      description: null,
      publishedAt: null,
      suspendedAt: null,
      deprecatedAt: null,
      agreementApprovalPolicy: null,
      id: version.id,
      version: version.version,
      state: version.state,
      voucherLifespan: version.voucherLifespan,
      dailyCallsPerConsumer: null,
      dailyCallsTotal: null,
    };

    const expectedDocumentSQL: EServiceTemplateVersionDocumentSQL = {
      ...doc,
      metadataVersion: 1,
      eserviceTemplateId: eserviceTemplate.id,
      versionId: version.id,
      uploadDate: doc.uploadDate.toISOString(),
    };

    expect(eserviceTemplateSQL).toStrictEqual(expectedEServiceTemplateSQL);
    expect(riskAnalysesSQL).toStrictEqual(
      expect.arrayContaining([
        expectedRiskAnalysisSQL1,
        expectedRiskAnalysisSQL2,
      ])
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expectedRiskAnalysisAnswersSQL
    );
    expect(versionsSQL).toStrictEqual([expectedEServiceTemplateVersionSQL]);
    expect(attributesSQL).toHaveLength(0);
    expect(interfacesSQL).toHaveLength(0);
    expect(documentsSQL).toStrictEqual(
      expect.arrayContaining([expectedDocumentSQL])
    );
  });
});
