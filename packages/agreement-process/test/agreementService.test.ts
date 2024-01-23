/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable functional/immutable-data */
import { describe, expect, it } from "vitest";
import {
  Agreement,
  Descriptor,
  EService,
  EServiceAttribute,
  Tenant,
  TenantAttribute,
  agreementCreationConflictingStates,
  agreementState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "pagopa-interop-commons";
import { AgreementQuery } from "../src/services/readmodel/agreementQuery.js";
import { TenantQuery } from "../src/services/readmodel/tenantQuery.js";
import { EserviceQuery } from "../src/services/readmodel/eserviceQuery.js";
import { createAgreementLogic } from "../src/services/agreementCreationProcessor.js";
import { ApiAgreementPayload } from "../src/model/types.js";
import { toAgreementStateV1 } from "../src/model/domain/toEvent.js";
import {
  agreementAlreadyExists,
  descriptorNotInExpectedState,
  eServiceNotFound,
  notLatestEServiceDescriptor,
} from "../src/model/domain/errors.js";
import { expectPastTimestamp, randomArrayItem } from "./utils/utils.js";

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
      const tenant: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: tenant.id,
        descriptors: [descriptor],
      };

      const agreementQueryMock = {
        getAllAgreements: () => Promise.resolve([]),
      } as unknown as AgreementQuery;

      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const tenantQueryMock = {
        getTenantById: () => Promise.resolve({ data: tenant }),
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: tenant.id,
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
          producerId: tenant.id,
          consumerId: tenant.id,
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

    it("should throw an eServiceNotFound error when EService does not exist", async () => {
      const agreementQueryMock = {} as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => undefined,
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: generateId(),
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

    it("should throw a notLatestEServiceDescriptor error when EService has no Descriptor", async () => {
      const eservice: EService = {
        ...generateMock(EService),
        descriptors: [],
      };

      const agreementQueryMock = {} as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: generateId(),
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
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
      ).rejects.toThrowError(
        notLatestEServiceDescriptor(
          unsafeBrandId(apiAgreementPayload.descriptorId)
        )
      );
    });

    it("should throw a notLatestEServiceDescriptor error when EService Descriptor is not the latest non-Draft Descriptor", async () => {
      const descriptor0: Descriptor = {
        ...generateMock(Descriptor),
        version: "0",
        state: "Deprecated",
      };
      const descriptor1: Descriptor = {
        ...generateMock(Descriptor),
        version: "1",
        state: "Published",
      };
      const eservice: EService = {
        ...generateMock(EService),
        descriptors: [descriptor0, descriptor1],
      };

      const agreementQueryMock = {} as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: generateId(),
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor0.id,
      };

      await expect(() =>
        createAgreementLogic(
          apiAgreementPayload,
          authData,
          agreementQueryMock,
          eserviceQueryMock,
          tenantQueryMock
        )
      ).rejects.toThrowError(
        notLatestEServiceDescriptor(
          unsafeBrandId(apiAgreementPayload.descriptorId)
        )
      );
    });

    it("should throw a descriptorNotInExpectedState error when EService latest non-Draft Descriptor is not published", async () => {
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        version: "0",
        state: "Deprecated",
      };
      const eservice: EService = {
        ...generateMock(EService),
        descriptors: [descriptor],
      };

      const agreementQueryMock = {} as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: generateId(),
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

      await expect(() =>
        createAgreementLogic(
          apiAgreementPayload,
          authData,
          agreementQueryMock,
          eserviceQueryMock,
          tenantQueryMock
        )
      ).rejects.toThrowError(
        descriptorNotInExpectedState(eservice.id, descriptor.id, ["Published"])
      );
    });

    it("should create an Agreement when EService latest descriptors are Draft, and the latest non-Draft is Published", async () => {
      const tenant: Tenant = generateMock(Tenant);
      const descriptor0: Descriptor = {
        ...generateMock(Descriptor),
        version: "0",
        state: "Published",
      };
      const descriptor1: Descriptor = {
        ...generateMock(Descriptor),
        version: "1",
        state: "Draft",
      };
      const descriptor2: Descriptor = {
        ...generateMock(Descriptor),
        version: "2",
        state: "Draft",
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: tenant.id,
        descriptors: [descriptor0, descriptor1, descriptor2],
      };

      const agreementQueryMock = {
        getAllAgreements: () => Promise.resolve([]),
      } as unknown as AgreementQuery;

      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const tenantQueryMock = {
        getTenantById: () => Promise.resolve({ data: tenant }),
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: tenant.id,
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor0.id,
      };

      const createEvent = await createAgreementLogic(
        apiAgreementPayload,
        authData,
        agreementQueryMock,
        eserviceQueryMock,
        tenantQueryMock
      );
      expect(createEvent.event.type).toBe("AgreementAdded");
    });
    it("should throw an agreementAlreadyExists error when a non-Archived and non-Rejected agreement already exists for the same EService and Consumer", async () => {
      const consumer: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: "Published",
      };
      const eservice: EService = {
        ...generateMock(EService),
        descriptors: [descriptor],
      };

      const conflictingAgreement: Agreement = {
        ...generateMock(Agreement),
        eserviceId: eservice.id,
        consumerId: consumer.id,
        state: randomArrayItem(agreementCreationConflictingStates),
      };
      const agreementQueryMock = {
        getAllAgreements: () => Promise.resolve([conflictingAgreement]),
      } as unknown as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...authDataMock,
        organizationId: consumer.id,
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

      await expect(() =>
        createAgreementLogic(
          apiAgreementPayload,
          authData,
          agreementQueryMock,
          eserviceQueryMock,
          tenantQueryMock
        )
      ).rejects.toThrowError(agreementAlreadyExists(consumer.id, eservice.id));
    });
  });
});
