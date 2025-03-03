/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-console */
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
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { diff } from "json-diff";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import {
  retrieveEserviceInterfacesSQL,
  retrieveDescriptorsSQL,
  retrieveEServiceSQL,
  retrieveRejectionReasonsSQL,
  retrieveEserviceDocumentsSQL,
  retrieveEserviceRiskAnalysesSQL,
  retrieveEserviceRiskAnalysisAnswersSQL,
  retrieveEserviceAttributesSQL,
} from "./eserviceTestReadModelService.js";
import {
  generateRiskAnalysisAnswersSQL,
  readModelDB,
  readModelService,
  stringToISOString,
} from "./utils.js";

describe("E-service queries", () => {
  describe("addEService", () => {
    it.only("should add a complete (*all* fields with values) e-service", async () => {
      const metadataVersion = 1;
      const rejectionReason = getMockDescriptorRejectionReason();
      const descriptorInterface = getMockDocument();
      const descriptorDocument = getMockDocument();
      const certifiedAttribute1 = getMockEServiceAttribute();
      const certifiedAttribute2 = getMockEServiceAttribute();
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[certifiedAttribute1], [certifiedAttribute2]],
          declared: [],
          verified: [],
        },
        interface: descriptorInterface,
        docs: [descriptorDocument],
        rejectionReasons: [rejectionReason],
        description: "description test",
        publishedAt: new Date(),
        suspendedAt: new Date(),
        deprecatedAt: new Date(),
        archivedAt: new Date(),
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      };

      const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
      const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);
      const eservice: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor],
          riskAnalysis: [riskAnalysis1, riskAnalysis2],
          isSignalHubEnabled: true,
          isClientAccessDelegable: true,
          isConsumerDelegable: true,
        },
        metadata: { version: metadataVersion },
      };

      await readModelService.upsertEService(eservice);

      const retrievedEserviceSQL = await retrieveEServiceSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedAndFormattedEserviceSQL = {
        ...retrievedEserviceSQL,
        createdAt: stringToISOString(retrievedEserviceSQL!.createdAt!),
      };
      const retrievedDescriptorsSQL = await retrieveDescriptorsSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedAndFormattedDescriptorsSQL = retrievedDescriptorsSQL?.map(
        (descriptor) => ({
          ...descriptor,
          createdAt: stringToISOString(descriptor.createdAt),
          publishedAt: stringToISOString(descriptor.publishedAt),
          suspendedAt: stringToISOString(descriptor.suspendedAt),
          deprecatedAt: stringToISOString(descriptor.deprecatedAt),
          archivedAt: stringToISOString(descriptor.archivedAt),
        })
      );
      const retrievedRejectionReasons = await retrieveRejectionReasonsSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedAndFormattedRejectionReasons =
        retrievedRejectionReasons?.map((rejection) => ({
          ...rejection,
          rejectedAt: stringToISOString(rejection.rejectedAt),
        }));

      const retrievedDocuments = await retrieveEserviceDocumentsSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedAndFormattedDocuments = retrievedDocuments?.map((doc) => ({
        ...doc,
        uploadDate: stringToISOString(doc.uploadDate),
      }));

      const retrievedInterfaces = await retrieveEserviceInterfacesSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedAndFormattedInterfaces = retrievedInterfaces?.map((i) => ({
        ...i,
        uploadDate: stringToISOString(i.uploadDate),
      }));
      const retrievedAttributes = await retrieveEserviceAttributesSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedRiskAnalyses = await retrieveEserviceRiskAnalysesSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedAndFormattedRiskAnalyses = retrievedRiskAnalyses?.map(
        (ra) => ({
          ...ra,
          createdAt: stringToISOString(ra.createdAt),
        })
      );
      const retrievedRiskANalysisAnswers =
        await retrieveEserviceRiskAnalysisAnswersSQL(
          eservice.data.id,
          readModelDB
        );

      const expectedEserviceSQL: EServiceSQL = {
        name: eservice.data.name,
        description: eservice.data.description,
        id: eservice.data.id,
        metadataVersion: eservice.metadata.version,
        producerId: eservice.data.producerId,
        technology: eservice.data.technology,
        createdAt: eservice.data.createdAt.toISOString(),
        mode: eservice.data.mode,
        isSignalHubEnabled: eservice.data.isSignalHubEnabled!,
        isConsumerDelegable: eservice.data.isConsumerDelegable!,
        isClientAccessDelegable: eservice.data.isClientAccessDelegable!,
      };
      const expectedDescriptors: EServiceDescriptorSQL[] = [
        {
          id: descriptor.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          version: descriptor.version,
          description: descriptor.description || null,
          state: descriptor.state,
          audience: descriptor.audience,
          voucherLifespan: descriptor.voucherLifespan,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: descriptor.dailyCallsTotal,
          agreementApprovalPolicy: descriptor.agreementApprovalPolicy!,
          createdAt: descriptor.createdAt.toISOString(),
          serverUrls: descriptor.serverUrls,
          publishedAt: descriptor.publishedAt!.toISOString(),
          suspendedAt: descriptor.suspendedAt!.toISOString(),
          deprecatedAt: descriptor.deprecatedAt!.toISOString(),
          archivedAt: descriptor.archivedAt!.toISOString(),
        },
      ];
      const expectedRejectionReasons: EServiceDescriptorRejectionReasonSQL[] = [
        {
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          rejectionReason: rejectionReason.rejectionReason,
          rejectedAt: rejectionReason.rejectedAt.toISOString(),
        },
      ];
      const expectedInterfaces: EServiceDescriptorInterfaceSQL[] = [
        {
          id: descriptorInterface.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          name: descriptorInterface.name,
          contentType: descriptorInterface.contentType,
          prettyName: descriptorInterface.prettyName,
          path: descriptorInterface.path,
          checksum: descriptorInterface.checksum,
          uploadDate: descriptorInterface.uploadDate.toISOString(),
        },
      ];
      const expectedDocuments: EServiceDescriptorDocumentSQL[] = [
        {
          id: descriptorDocument.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          name: descriptorDocument.name,
          contentType: descriptorDocument.contentType,
          prettyName: descriptorDocument.prettyName,
          path: descriptorDocument.path,
          checksum: descriptorDocument.checksum,
          uploadDate: descriptorDocument.uploadDate.toISOString(),
        },
      ];
      const expectedAttributes: EServiceDescriptorAttributeSQL[] = [
        {
          attributeId: certifiedAttribute1.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          explicitAttributeVerification:
            certifiedAttribute1.explicitAttributeVerification,
          kind: attributeKind.certified,
          groupId: 0,
        },
        {
          attributeId: certifiedAttribute2.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          explicitAttributeVerification:
            certifiedAttribute2.explicitAttributeVerification,
          kind: attributeKind.certified,
          groupId: 1,
        },
      ];
      const expectedRiskAnalyses: EServiceRiskAnalysisSQL[] = [
        {
          id: riskAnalysis1.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          name: riskAnalysis1.name,
          createdAt: riskAnalysis1.createdAt.toISOString(),
          riskAnalysisFormId: riskAnalysis1.riskAnalysisForm.id,
          riskAnalysisFormVersion: riskAnalysis1.riskAnalysisForm.version,
        },
        {
          id: riskAnalysis2.id,
          eserviceId: eservice.data.id,
          metadataVersion,
          name: riskAnalysis2.name,
          createdAt: riskAnalysis2.createdAt.toISOString(),
          riskAnalysisFormId: riskAnalysis2.riskAnalysisForm.id,
          riskAnalysisFormVersion: riskAnalysis2.riskAnalysisForm.version,
        },
      ];
      const expectedRiskAnalysisAnswers = generateRiskAnalysisAnswersSQL(
        eservice.data.id,
        [riskAnalysis1, riskAnalysis2]
      );

      expect(retrievedAndFormattedEserviceSQL).toMatchObject(
        expectedEserviceSQL
      );
      expect(retrievedAndFormattedDescriptorsSQL).toMatchObject(
        expectedDescriptors
      );
      expect(retrievedAndFormattedRejectionReasons).toMatchObject(
        expectedRejectionReasons
      );
      expect(retrievedAndFormattedInterfaces).toMatchObject(expectedInterfaces);
      expect(retrievedAndFormattedDocuments).toMatchObject(expectedDocuments);
      expect(retrievedAttributes).toMatchObject(
        expect.arrayContaining(expectedAttributes)
      );
      expect(retrievedAndFormattedRiskAnalyses).toMatchObject(
        expectedRiskAnalyses
      );
      expect(retrievedRiskANalysisAnswers).toMatchObject(
        expectedRiskAnalysisAnswers
      );
    });

    it("should convert an incomplete e-service into e-service SQL objects (undefined -> null)", async () => {
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
        interface: undefined,
        rejectionReasons: undefined,
        description: undefined,
        // publishedAt: undefined,
        // suspendedAt: undefined,
        // deprecatedAt: undefined,
        // archivedAt: undefined,
        agreementApprovalPolicy: undefined,
      };

      const eservice: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor],
          riskAnalysis: [riskAnalysis1, riskAnalysis2],
          isSignalHubEnabled: undefined,
          isClientAccessDelegable: undefined,
          isConsumerDelegable: undefined,
        },
        metadata: { version: 1 },
      };

      await readModelService.upsertEService(eservice);

      const retrievedEService = await readModelService.getEServiceById(
        eservice.data.id
      );

      const resDiff = diff(eservice, retrievedEService, {
        sort: true,
      });

      if (resDiff) {
        console.error(resDiff);

        // if it fails use this output, otherwise undefined values are not printed
        console.log(
          JSON.stringify(
            resDiff,
            (_k, v) => (v === undefined ? "undefined" : v),
            2
          )
        );
      }

      expect(resDiff).toBeUndefined();
    });
  });

  describe("get", () => {
    it("undefined", () => {
      expect(1).toBe(1);
    });
  });

  describe("delete", () => {
    it("", () => {
      expect(1).toBe(1);
    });
  });
});
