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
  descriptorState,
  generateId,
  tenantAttributeType,
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
  tenantIdNotFound,
} from "../src/model/domain/errors.js";
import { AgreementQueryFilters } from "../src/services/readmodel/readModelService.js";
import { expectPastTimestamp, randomArrayItem } from "./utils/utils.js";

export const notDraftDescriptorStates = Object.values(descriptorState).filter(
  (state) => state !== descriptorState.draft
);

describe("AgreementService", () => {
  describe("createAgreement", () => {
    it("should create an Agreement when eService producer and Agreement consumer are the same tenant", async () => {
      const tenant: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: descriptorState.published,
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
        // to test that the logic passes the correct param
        getEServiceById: (id: EService["id"]) =>
          id === eservice.id ? Promise.resolve({ data: eservice }) : undefined,
      } as unknown as EserviceQuery;

      const tenantQueryMock = {
        // to test that the logic passes the correct param
        getTenantById: (id: Tenant["id"]) =>
          id === tenant.id ? Promise.resolve({ data: tenant }) : undefined,
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...generateMock(AuthData),
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
        type: tenantAttributeType.CERTIFIED,
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
        state: descriptorState.published,
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
        // to make sure that the logic fetches the correct tenant
        getTenantById: (id: Tenant["id"]) =>
          Promise.resolve({
            data: id === eserviceProducer.id ? eserviceProducer : consumer,
          }),
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...generateMock(AuthData),
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
        ...generateMock(AuthData),
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
        ...generateMock(AuthData),
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
        state: randomArrayItem(notDraftDescriptorStates),
      };
      const descriptor1: Descriptor = {
        ...generateMock(Descriptor),
        version: "1",
        state: randomArrayItem(notDraftDescriptorStates),
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
        ...generateMock(AuthData),
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
        state: randomArrayItem(
          Object.values(descriptorState).filter(
            (state) =>
              state !== descriptorState.published &&
              state !== descriptorState.draft
          )
        ),
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
        ...generateMock(AuthData),
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
        descriptorNotInExpectedState(eservice.id, descriptor.id, [
          descriptorState.published,
        ])
      );
    });

    it("should create an Agreement when EService latest descriptors are Draft, and the latest non-Draft is Published", async () => {
      const tenant: Tenant = generateMock(Tenant);
      const descriptor0: Descriptor = {
        ...generateMock(Descriptor),
        version: "0",
        state: descriptorState.published,
      };
      const descriptor1: Descriptor = {
        ...generateMock(Descriptor),
        version: "1",
        state: descriptorState.draft,
      };
      const descriptor2: Descriptor = {
        ...generateMock(Descriptor),
        version: "2",
        state: descriptorState.draft,
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
        ...generateMock(AuthData),
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
    it("should throw an agreementAlreadyExists error when an Agreement in a conflicting state already exists for the same EService and Consumer", async () => {
      const consumer: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: descriptorState.published,
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
        getAllAgreements: (filters: AgreementQueryFilters) =>
          // to test that the logic passees the correct filters
          Promise.resolve(
            [conflictingAgreement].filter(
              (agreement) =>
                filters.agreementStates?.includes(agreement.state) &&
                filters.consumerId === consumer.id &&
                filters.eserviceId === eservice.id
            )
          ),
      } as unknown as AgreementQuery;
      const tenantQueryMock = {} as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...generateMock(AuthData),
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
    it("should create an Agreement when Agreements in non-conflicting states exist for the same EService and Consumer", async () => {
      const tenant: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: descriptorState.published,
      };
      const eservice: EService = {
        ...generateMock(EService),
        producerId: tenant.id,
        descriptors: [descriptor],
      };
      const otherAgreement: Agreement = {
        ...generateMock(Agreement),
        eserviceId: eservice.id,
        consumerId: tenant.id,
        state: randomArrayItem(
          Object.values(agreementState).filter(
            (state) => !agreementCreationConflictingStates.includes(state)
          )
        ),
      };
      const agreementQueryMock = {
        getAllAgreements: (filters: AgreementQueryFilters) =>
          Promise.resolve(
            // to test that the logic passees the correct filters
            [otherAgreement].filter(
              (agreement) =>
                filters.agreementStates?.includes(agreement.state) &&
                filters.consumerId === tenant.id &&
                filters.eserviceId === eservice.id
            )
          ),
      } as unknown as AgreementQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const tenantQueryMock = {
        getTenantById: () => Promise.resolve({ data: tenant }),
      } as unknown as TenantQuery;

      const authData: AuthData = {
        ...generateMock(AuthData),
        organizationId: tenant.id,
      };
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
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
    it("should throw a tenantIdNotFound error when a the consumer Tenant does not exist", async () => {
      const consumer: Tenant = generateMock(Tenant);
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        state: descriptorState.published,
      };
      const eservice: EService = {
        ...generateMock(EService),
        descriptors: [descriptor],
      };

      const agreementQueryMock = {
        getAllAgreements: () => Promise.resolve([]),
      } as unknown as AgreementQuery;
      const tenantQueryMock = {
        getTenantById: () => undefined,
      } as unknown as TenantQuery;
      const eserviceQueryMock = {
        getEServiceById: () => Promise.resolve({ data: eservice }),
      } as unknown as EserviceQuery;

      const authData: AuthData = {
        ...generateMock(AuthData),
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
      ).rejects.toThrowError(tenantIdNotFound(consumer.id));
    });
  });
});
