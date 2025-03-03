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
  Descriptor,
  EService,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { diff } from "json-diff";
import {
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import {
  dateToCustomISOString,
  readModelDB,
  readModelService,
} from "./utils.js";
import {
  retrieveEserviceInterfacesSQL,
  retrieveDescriptorsSQL,
  retrieveEServiceSQL,
  retrieveRejectionReasonsSQL,
  retrieveEserviceDocumentsSQL,
} from "./eserviceTestReadModelService.js";

describe("E-service queries", () => {
  describe("addEService", () => {
    it.only("should add a complete (*all* fields with values) e-service", async () => {
      const metadataVersion = 1;
      const rejectionReason = getMockDescriptorRejectionReason();
      const descriptorInterface = getMockDocument();
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: descriptorInterface,
        docs: [getMockDocument()],
        rejectionReasons: [rejectionReason],
        description: "description test",
        publishedAt: new Date(),
        suspendedAt: new Date(),
        deprecatedAt: new Date(),
        archivedAt: new Date(),
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      };

      const eservice: WithMetadata<EService> = {
        data: {
          ...getMockEService(),
          descriptors: [descriptor],
          riskAnalysis: [
            getMockValidRiskAnalysis(tenantKind.PA),
            getMockValidRiskAnalysis(tenantKind.PA),
          ],
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
      const retrievedDescriptorsSQL = await retrieveDescriptorsSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedRejectionReasons = await retrieveRejectionReasonsSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedInterfaces = await retrieveEserviceInterfacesSQL(
        eservice.data.id,
        readModelDB
      );
      const retrievedDocuments = await retrieveEserviceDocumentsSQL(
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
        createdAt: dateToCustomISOString(eservice.data.createdAt),
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
          createdAt: dateToCustomISOString(descriptor.createdAt),
          serverUrls: descriptor.serverUrls,
          publishedAt: dateToCustomISOString(descriptor.publishedAt),
          suspendedAt: dateToCustomISOString(descriptor.suspendedAt),
          deprecatedAt: dateToCustomISOString(descriptor.deprecatedAt),
          archivedAt: dateToCustomISOString(descriptor.archivedAt),
        },
      ];
      const expectedRejectionReasons: EServiceDescriptorRejectionReasonSQL[] = [
        {
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          rejectionReason: rejectionReason.rejectionReason,
          rejectedAt: dateToCustomISOString(rejectionReason.rejectedAt),
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
          uploadDate: dateToCustomISOString(descriptorInterface.uploadDate),
        },
      ];
      const expectedDocuments: EServiceDescriptorDocumentSQL[] = [
        {
          id: descriptor.docs[0].id,
          eserviceId: eservice.data.id,
          metadataVersion,
          descriptorId: descriptor.id,
          name: descriptor.docs[0].name,
          contentType: descriptor.docs[0].contentType,
          prettyName: descriptor.docs[0].prettyName,
          path: descriptor.docs[0].path,
          checksum: descriptor.docs[0].checksum,
          uploadDate: dateToCustomISOString(descriptor.docs[0].uploadDate),
        },
      ];

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
      expect(retrievedDescriptorsSQL).toMatchObject(expectedDescriptors);
      expect(retrievedRejectionReasons).toMatchObject(expectedRejectionReasons);
      expect(retrievedInterfaces).toMatchObject(expectedInterfaces);
      expect(retrievedDocuments).toMatchObject(expectedDocuments);
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
