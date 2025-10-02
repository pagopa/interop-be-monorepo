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
  EServiceAddedV2,
  EserviceAttributes,
  EServiceTemplateId,
  EServiceTemplateVersionRef,
  fromEServiceV2,
  generateId,
  tenantKind,
  toEServiceV2,
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
    const templateId = generateId<EServiceTemplateId>();
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

    const aggregatedEservice = aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateVersionRefsSQL,
    });

    expect(aggregatedEservice).toStrictEqual({
      data: eservice,
      metadata: { version: 1 },
    });
  });

  it("should convert an incomplete eservice items into an eservice(undefined -> null)", () => {
    const eservice = getMockEService();

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

    const aggregatedEservice = aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      descriptorsSQL,
      attributesSQL,
      interfacesSQL,
      documentsSQL,
      rejectionReasonsSQL,
      templateVersionRefsSQL,
    });

    expect(aggregatedEservice).toStrictEqual({
      data: eservice,
      metadata: { version: 1 },
    });
  });

  /**
   * !! IMPORTANT !!
   * This test ensures that the order of attribute groups are consistent with the original order
   * in the descriptor, even after protobuf deserialization, splitting,
   * aggregating a reserialization of the eservice object.
   *
   * This is important because some functionalities in APIV2 (e.g. in-add attributes endpoints)
   * rely on the order of these groups.
   */
  it("should keep the descriptor attributes group order by groupIndex", () => {
    const descriptorCertifiedAttributeGroups: EserviceAttributes["certified"] =
      [
        [getMockEServiceAttribute()],
        [getMockEServiceAttribute(), getMockEServiceAttribute()],
        [getMockEServiceAttribute(), getMockEServiceAttribute()],
        [
          getMockEServiceAttribute(),
          getMockEServiceAttribute(),
          getMockEServiceAttribute(),
        ],
      ];

    const descriptorVerifiedAttributeGroups: EserviceAttributes["verified"] = [
      [getMockEServiceAttribute()],
      [getMockEServiceAttribute(), getMockEServiceAttribute()],
      [getMockEServiceAttribute(), getMockEServiceAttribute()],
      [
        getMockEServiceAttribute(),
        getMockEServiceAttribute(),
        getMockEServiceAttribute(),
      ],
    ];

    const descriptorDeclaredAttributeGroups: EserviceAttributes["declared"] = [
      [getMockEServiceAttribute()],
      [getMockEServiceAttribute(), getMockEServiceAttribute()],
      [getMockEServiceAttribute(), getMockEServiceAttribute()],
      [
        getMockEServiceAttribute(),
        getMockEServiceAttribute(),
        getMockEServiceAttribute(),
      ],
    ];

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: descriptorCertifiedAttributeGroups,
        verified: descriptorVerifiedAttributeGroups,
        declared: descriptorDeclaredAttributeGroups,
      },
    };

    const eservice = getMockEService(undefined, undefined, [descriptor]);
    const serialized = EServiceAddedV2.toBinary({
      eservice: toEServiceV2(eservice),
    });

    // eslint-disable-next-line functional/no-let
    let deserialized = EServiceAddedV2.fromBinary(serialized).eservice;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of Array(400)) {
      if (!deserialized) {
        throw new Error("Deserialized eservice is undefined");
      }

      const deserializedEService = fromEServiceV2(deserialized);

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
      } = splitEserviceIntoObjectsSQL(deserializedEService, 1);

      const aggregatedEservice = aggregateEservice({
        eserviceSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        descriptorsSQL,
        attributesSQL,
        interfacesSQL,
        documentsSQL,
        rejectionReasonsSQL,
        templateVersionRefsSQL,
      }).data;

      const aggregatedDescriptor = aggregatedEservice.descriptors[0];

      expect(aggregatedDescriptor.attributes.certified).toHaveLength(
        descriptorCertifiedAttributeGroups.length
      );
      aggregatedDescriptor.attributes.certified.forEach((group, index) => {
        expect(group).toHaveLength(
          descriptorCertifiedAttributeGroups[index].length
        );
      });

      expect(aggregatedDescriptor.attributes.verified).toHaveLength(
        descriptorVerifiedAttributeGroups.length
      );
      aggregatedDescriptor.attributes.verified.forEach((group, index) => {
        expect(group).toHaveLength(
          descriptorVerifiedAttributeGroups[index].length
        );
      });

      expect(aggregatedDescriptor.attributes.declared).toHaveLength(
        descriptorDeclaredAttributeGroups.length
      );
      aggregatedDescriptor.attributes.declared.forEach((group, index) => {
        expect(group).toHaveLength(
          descriptorDeclaredAttributeGroups[index].length
        );
      });

      deserialized = EServiceAddedV2.fromBinary(
        EServiceAddedV2.toBinary({
          eservice: toEServiceV2(aggregatedEservice),
        })
      ).eservice;
    }
  });
});
