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
  attributeKind,
  Descriptor,
  EService,
  EServiceTemplateId,
  EServiceTemplateVersionRef,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorTemplateVersionRefSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import { splitEserviceIntoObjectsSQL } from "../src/catalog/splitters.js";
import { generateEServiceRiskAnalysisAnswersSQL } from "./eserviceUtils.js";

describe("E-service splitter", () => {
  it("should convert a complete e-service into e-service SQL objects", () => {
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
    const templateId: EServiceTemplateId = generateId();
    const personalData = true;

    const templateVersionRef: EServiceTemplateVersionRef = {
      id: generateId(),
      interfaceMetadata: {
        contactName: "contact name",
        contactEmail: "contact email",
        contactUrl: "contact url",
        termsAndConditionsUrl: "terms and conditions url",
      },
    };

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
      templateVersionRef,
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      isSignalHubEnabled,
      isClientAccessDelegable,
      isConsumerDelegable,
      templateId,
      personalData,
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
      templateVersionRefsSQL,
    } = splitEserviceIntoObjectsSQL(eservice, 1);

    const expectedEServiceSQL: EServiceSQL = {
      id: eservice.id,
      metadataVersion: 1,
      name: eservice.name,
      createdAt: eservice.createdAt.toISOString(),
      producerId: eservice.producerId,
      description: eservice.description,
      technology: eservice.technology,
      mode: eservice.mode,
      isSignalHubEnabled,
      isClientAccessDelegable,
      isConsumerDelegable,
      templateId,
      personalData,
    };

    const expectedRiskAnalysisSQL1: EServiceRiskAnalysisSQL = {
      id: riskAnalysis1.id,
      metadataVersion: 1,
      name: riskAnalysis1.name,
      createdAt: riskAnalysis1.createdAt.toISOString(),
      eserviceId: eservice.id,
      riskAnalysisFormId: riskAnalysis1.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis1.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisSQL2: EServiceRiskAnalysisSQL = {
      id: riskAnalysis2.id,
      metadataVersion: 1,
      name: riskAnalysis2.name,
      createdAt: riskAnalysis2.createdAt.toISOString(),
      eserviceId: eservice.id,
      riskAnalysisFormId: riskAnalysis2.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis2.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[] =
      generateEServiceRiskAnalysisAnswersSQL(
        eservice.id,
        [riskAnalysis1, riskAnalysis2],
        1
      );

    const expectedDescriptorSQL: EServiceDescriptorSQL = {
      metadataVersion: 1,
      createdAt: descriptor.createdAt.toISOString(),
      eserviceId: eservice.id,
      description: "description test",
      publishedAt: publishedAt.toISOString(),
      suspendedAt: suspendedAt.toISOString(),
      deprecatedAt: deprecatedAt.toISOString(),
      archivedAt: archivedAt.toISOString(),
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      id: descriptor.id,
      version: descriptor.version,
      state: descriptor.state,
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      serverUrls: descriptor.serverUrls,
    };

    const expectedAttributeSQL: EServiceDescriptorAttributeSQL = {
      metadataVersion: 1,
      eserviceId: eservice.id,
      kind: attributeKind.certified,
      attributeId: certifiedAttribute.id,
      descriptorId: descriptor.id,
      groupId: 0,
      explicitAttributeVerification:
        certifiedAttribute.explicitAttributeVerification,
      dailyCallsPerConsumer: certifiedAttribute.dailyCallsPerConsumer ?? null,
    };

    const expectedDocumentSQL: EServiceDescriptorDocumentSQL = {
      ...doc,
      metadataVersion: 1,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      uploadDate: doc.uploadDate.toISOString(),
    };

    const expectedInterfaceDocSQL: EServiceDescriptorDocumentSQL = {
      ...interfaceDoc,
      metadataVersion: 1,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      uploadDate: interfaceDoc.uploadDate.toISOString(),
    };

    const expectedRejectionReasonSQL: EServiceDescriptorRejectionReasonSQL = {
      ...rejectionReason,
      metadataVersion: 1,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      rejectedAt: rejectionReason.rejectedAt.toISOString(),
    };

    const expectedTemplateVersionRef: EServiceDescriptorTemplateVersionRefSQL =
      {
        eserviceTemplateVersionId: templateVersionRef.id,
        contactName: templateVersionRef.interfaceMetadata?.contactName ?? null,
        contactEmail:
          templateVersionRef.interfaceMetadata?.contactEmail ?? null,
        contactUrl: templateVersionRef.interfaceMetadata?.contactUrl ?? null,
        termsAndConditionsUrl:
          templateVersionRef.interfaceMetadata?.termsAndConditionsUrl ?? null,
        metadataVersion: 1,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

    expect(eserviceSQL).toStrictEqual(expectedEServiceSQL);
    expect(riskAnalysesSQL).toStrictEqual(
      expect.arrayContaining([
        expectedRiskAnalysisSQL1,
        expectedRiskAnalysisSQL2,
      ])
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expectedRiskAnalysisAnswersSQL
    );
    expect(descriptorsSQL).toStrictEqual([expectedDescriptorSQL]);
    expect(attributesSQL).toStrictEqual([expectedAttributeSQL]);
    expect(interfacesSQL).toStrictEqual([expectedInterfaceDocSQL]);
    expect(documentsSQL).toStrictEqual(
      expect.arrayContaining([expectedDocumentSQL])
    );
    expect(rejectionReasonsSQL).toStrictEqual([expectedRejectionReasonSQL]);
    expect(templateVersionRefsSQL).toStrictEqual([expectedTemplateVersionRef]);
  });

  it("should convert an incomplete e-service into e-service SQL objects (undefined -> null)", () => {
    const doc = getMockDocument();
    const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
    const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: [[]],
        declared: [],
        verified: [],
      },
      docs: [doc],
      interface: undefined,
      rejectionReasons: undefined,
      description: undefined,
      publishedAt: undefined,
      suspendedAt: undefined,
      deprecatedAt: undefined,
      archivedAt: undefined,
      agreementApprovalPolicy: undefined,
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      isSignalHubEnabled: false,
      isClientAccessDelegable: undefined,
      isConsumerDelegable: undefined,
      personalData: undefined,
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
      templateVersionRefsSQL,
    } = splitEserviceIntoObjectsSQL(eservice, 1);

    const expectedEServiceSQL: EServiceSQL = {
      id: eservice.id,
      metadataVersion: 1,
      name: eservice.name,
      createdAt: eservice.createdAt.toISOString(),
      producerId: eservice.producerId,
      description: eservice.description,
      technology: eservice.technology,
      mode: eservice.mode,
      isSignalHubEnabled: false,
      isClientAccessDelegable: null,
      isConsumerDelegable: null,
      templateId: null,
      personalData: null,
    };

    const expectedRiskAnalysisSQL1: EServiceRiskAnalysisSQL = {
      id: riskAnalysis1.id,
      metadataVersion: 1,
      name: riskAnalysis1.name,
      createdAt: riskAnalysis1.createdAt.toISOString(),
      eserviceId: eservice.id,
      riskAnalysisFormId: riskAnalysis1.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis1.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisSQL2: EServiceRiskAnalysisSQL = {
      id: riskAnalysis2.id,
      metadataVersion: 1,
      name: riskAnalysis2.name,
      createdAt: riskAnalysis2.createdAt.toISOString(),
      eserviceId: eservice.id,
      riskAnalysisFormId: riskAnalysis2.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis2.riskAnalysisForm.version,
    };

    const expectedRiskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[] =
      generateEServiceRiskAnalysisAnswersSQL(
        eservice.id,
        [riskAnalysis1, riskAnalysis2],
        1
      );

    const expectedDescriptorSQL: EServiceDescriptorSQL = {
      metadataVersion: 1,
      createdAt: descriptor.createdAt.toISOString(),
      eserviceId: eservice.id,
      description: null,
      publishedAt: null,
      suspendedAt: null,
      deprecatedAt: null,
      archivedAt: null,
      agreementApprovalPolicy: null,
      id: descriptor.id,
      version: descriptor.version,
      state: descriptor.state,
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      serverUrls: descriptor.serverUrls,
    };

    const expectedDocumentSQL: EServiceDescriptorDocumentSQL = {
      ...doc,
      metadataVersion: 1,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      uploadDate: doc.uploadDate.toISOString(),
    };

    expect(eserviceSQL).toStrictEqual(expectedEServiceSQL);
    expect(riskAnalysesSQL).toStrictEqual(
      expect.arrayContaining([
        expectedRiskAnalysisSQL1,
        expectedRiskAnalysisSQL2,
      ])
    );
    expect(riskAnalysisAnswersSQL).toStrictEqual(
      expectedRiskAnalysisAnswersSQL
    );
    expect(descriptorsSQL).toStrictEqual([expectedDescriptorSQL]);
    expect(attributesSQL).toHaveLength(0);
    expect(interfacesSQL).toHaveLength(0);
    expect(documentsSQL).toStrictEqual(
      expect.arrayContaining([expectedDocumentSQL])
    );
    expect(rejectionReasonsSQL).toHaveLength(0);
    expect(templateVersionRefsSQL).toHaveLength(0);
  });
});
