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
    function generateRandomEServiceAttributes({
      maxGroupsNum,
      maxAttributesNum,
    }: {
      maxGroupsNum: number;
      maxAttributesNum: number;
    }): EserviceAttributes {
      function generateRandomAttributeGroups(): EserviceAttributes[
        | "certified"
        | "declared"
        | "verified"] {
        const randomGroupsNum = Math.floor(Math.random() * maxGroupsNum) + 1;
        return Array(randomGroupsNum)
          .fill(null)
          .map(() => {
            const randomAttributesNum =
              Math.floor(Math.random() * maxAttributesNum) + 1;
            return Array(randomAttributesNum)
              .fill(null)
              .map(() => getMockEServiceAttribute());
          });
      }

      return {
        certified: generateRandomAttributeGroups(),
        declared: generateRandomAttributeGroups(),
        verified: generateRandomAttributeGroups(),
      };
    }

    // Given numbers are just casual
    const eservice = getMockEService(undefined, undefined, [
      {
        ...getMockDescriptor(),
        attributes: generateRandomEServiceAttributes({
          maxGroupsNum: 5,
          maxAttributesNum: 20,
        }),
      },
      {
        ...getMockDescriptor(),
        attributes: generateRandomEServiceAttributes({
          maxGroupsNum: 20,
          maxAttributesNum: 50,
        }),
      },
      {
        ...getMockDescriptor(),
        attributes: generateRandomEServiceAttributes({
          maxGroupsNum: 4,
          maxAttributesNum: 5,
        }),
      },
    ]);

    // eslint-disable-next-line functional/no-let
    let serialized = EServiceAddedV2.toBinary({
      eservice: toEServiceV2(eservice),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of Array(400)) {
      // eslint-disable-next-line functional/no-let
      const deserialized = EServiceAddedV2.fromBinary(serialized).eservice;

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

      const aggregatedDescriptors = aggregatedEservice.descriptors;

      function checkForOrderConsistency<
        TAttributeGroup extends EserviceAttributes[
          | "certified"
          | "declared"
          | "verified"]
      >(original: TAttributeGroup, aggregated: TAttributeGroup): void {
        // Check that the number of groups is the same
        expect(aggregated).toHaveLength(original.length);
        // Check that each group has the same number of attributes...
        aggregated.forEach((group, index) => {
          expect(group).toHaveLength(original[index].length);
          // ... and that each attribute is the same (order matters)
          group.forEach((attribute, attrIndex) => {
            expect(attribute).toStrictEqual(original[index][attrIndex]);
          });
        });
      }

      aggregatedDescriptors.forEach((aggregatedDescriptor, index) => {
        checkForOrderConsistency(
          eservice.descriptors[index].attributes.certified,
          aggregatedDescriptor.attributes.certified
        );
        checkForOrderConsistency(
          eservice.descriptors[index].attributes.verified,
          aggregatedDescriptor.attributes.verified
        );
        checkForOrderConsistency(
          eservice.descriptors[index].attributes.declared,
          aggregatedDescriptor.attributes.declared
        );
      });

      serialized = EServiceAddedV2.toBinary({
        eservice: toEServiceV2(aggregatedEservice),
      });
    }
  });
});
