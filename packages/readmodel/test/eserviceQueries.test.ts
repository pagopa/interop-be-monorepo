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
import { EServiceSQL } from "pagopa-interop-readmodel-models";
import {
  dateToCustomISOString,
  readModelDB,
  readModelService,
} from "./utils.js";
import { retrieveEServiceSQL } from "./eserviceTestReadModelService.js";

describe("E-service queries", () => {
  describe("addEService", () => {
    it.only("should add a complete (*all* fields with values) e-service", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [],
          verified: [],
        },
        interface: getMockDocument(),
        docs: [getMockDocument()],
        rejectionReasons: [getMockDescriptorRejectionReason()],
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
        metadata: { version: 1 },
      };

      await readModelService.upsertEService(eservice);

      const retrievedEserviceSQL = await retrieveEServiceSQL(
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

      expect(retrievedEserviceSQL).toMatchObject(expectedEserviceSQL);
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
