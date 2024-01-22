/* eslint-disable functional/immutable-data */
import { describe, expect, it } from "vitest";
import {
  Descriptor,
  EService,
  EServiceAttribute,
  Tenant,
  TenantAttribute,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "pagopa-interop-commons";
import { AgreementQuery } from "../src/services/readmodel/agreementQuery.js";
import { TenantQuery } from "../src/services/readmodel/tenantQuery.js";
import { EserviceQuery } from "../src/services/readmodel/eserviceQuery.js";
import { createAgreementLogic } from "../src/services/agreementCreationProcessor.js";
import { ApiAgreementPayload } from "../src/model/types.js";
import { toAgreementStateV1 } from "../src/model/domain/toEvent.js";
import { eServiceNotFound } from "../src/model/domain/errors.js";
import { expectPastTimestamp } from "./utils/utils.js";

const authDataMock: AuthData = {
  organizationId: "organizationId",
  userId: "userId",
  userRoles: ["ADMIN"],
  externalId: {
    origin: "IPA",
    value: "123456",
  },
};

describe("AgreementService", () => {
  describe("createAgreement", () => {
    it("should create an Agreement when eService producer and Agreement consumer are the same tenant", async () => {
      const eserviceProducer: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: eserviceProducer.id,
        descriptors: [descriptor],
      };

      const agreementQueryMock = {
        getAllAgreements: () => Promise.resolve([]),
      } as unknown as AgreementQuery;

      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const tenantQueryMock = {
        getTenantById: () => Promise.resolve({ data: eserviceProducer }),
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: eserviceProducer.id,
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      const createEvent = await createAgreementLogic(
        apiAgreementPayload,
        authData,
        agreementQueryMock,
        eserviceQueryMock,
        tenantQueryMock
      );
      expect(createEvent.event.type).toBe("AgreementAdded");
      expect(createEvent.event.data).toMatchObject({
        agreement: {
          id: createEvent.streamId,
          eserviceId: apiAgreementPayload.eserviceId,
          descriptorId: apiAgreementPayload.descriptorId,
          producerId: eserviceProducer.id,
          consumerId: eserviceProducer.id,
          state: toAgreementStateV1(agreementState.draft),
          verifiedAttributes: [],
          certifiedAttributes: [],
          declaredAttributes: [],
          consumerDocuments: [],
          stamps: {},
          contract: undefined,
          createdAt: expect.any(BigInt),
        },
      });
      expect(createEvent.event.data)
        .property("agreement")
        .property("createdAt")
        .satisfy(expectPastTimestamp);
    });

    it("should create an Agreement when eService producer and Agreement consumer are different tenants", async () => {
      const eserviceProducer: Tenant = generateMock(Tenant);

      // In this case, the consumer must have a not revoked certified attribute
      const certifiedTenantAttribute: TenantAttribute = {
        ...generateMock(TenantAttribute),
        type: "certified",
        revocationTimestamp: undefined,
      };
      const consumer: Tenant = {
        ...generateMock(Tenant),
        attributes: [certifiedTenantAttribute],
      };

      // The same attribute must be present in the eService Descriptor certified attributes
      const certifiedDescriptorAttribute: EServiceAttribute = {
        ...generateMock(EServiceAttribute),
        id: certifiedTenantAttribute.id,
      };
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
        attributes: {
          certified: [[certifiedDescriptorAttribute]],
          declared: [],
          verified: [],
        },
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: eserviceProducer.id,
        descriptors: [descriptor],
      };
      const agreementQueryMock = {
        getAllAgreements: () => Promise.resolve([]),
      } as unknown as AgreementQuery;

      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const tenantQueryMock = {
        getTenantById: (id: Tenant["id"]) =>
          Promise.resolve({
            data: id === eserviceProducer.id ? eserviceProducer : consumer,
          }),
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: consumer.id, // different from eserviceProducer
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };
      const createEvent = await createAgreementLogic(
        apiAgreementPayload,
        authData,
        agreementQueryMock,
        eserviceQueryMock,
        tenantQueryMock
      );

      expect(createEvent.event.type).toBe("AgreementAdded");
      expect(createEvent.event.data).toMatchObject({
        agreement: {
          id: createEvent.streamId,
          eserviceId: apiAgreementPayload.eserviceId,
          descriptorId: apiAgreementPayload.descriptorId,
          producerId: eserviceProducer.id,
          consumerId: consumer.id,
          state: toAgreementStateV1(agreementState.draft),
          verifiedAttributes: [],
          certifiedAttributes: [],
          declaredAttributes: [],
          consumerDocuments: [],
          stamps: {},
          contract: undefined,
          createdAt: expect.any(BigInt),
        },
      });
      expect(createEvent.event.data)
        .property("agreement")
        .property("createdAt")
        .satisfy(expectPastTimestamp);
    });
    it("should throw an error when EService does not exist", async () => {
      const agreementQueryMock = {} as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => undefined,
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: "organizationId",
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: generateId(),
        descriptorId: generateId(),
      };

      await expect(() =>
        createAgreementLogic(
          apiAgreementPayload,
          authData,
          agreementQueryMock,
          eserviceQueryMock,
          tenantQueryMock
        )
      ).rejects.toThrowError(eServiceNotFound(apiAgreementPayload.eserviceId));
    });
  });
});
