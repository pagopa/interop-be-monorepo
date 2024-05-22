/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  EService,
  EServiceId,
  Tenant,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { agreementNotFound } from "../src/model/domain/errors.js";
import {
  CompactEService,
  CompactOrganization,
} from "../src/model/domain/models.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
} from "./utils.js";

describe("Agreement service", () => {
  describe("get agreement", () => {
    it("should get an agreement", async () => {
      const agreement: Agreement = getMockAgreement();
      await addOneAgreement(agreement);
      await addOneAgreement(getMockAgreement());

      const result = await agreementService.getAgreementById(
        agreement.id,
        genericLogger
      );
      expect(result).toEqual(agreement);
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const agreementId = generateId<AgreementId>();

      await addOneAgreement(getMockAgreement());

      await expect(
        agreementService.getAgreementById(agreementId, genericLogger)
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });
  });
  describe("get agreement consumers / producers", () => {
    let tenant1: Tenant;
    let tenant2: Tenant;
    let tenant3: Tenant;
    let tenant4: Tenant;
    let tenant5: Tenant;
    let tenant6: Tenant;

    const toCompactOrganization = (tenant: Tenant): CompactOrganization => ({
      id: tenant.id,
      name: tenant.name,
    });

    beforeEach(async () => {
      tenant1 = { ...getMockTenant(), name: "Tenant 1 Foo" };
      tenant2 = { ...getMockTenant(), name: "Tenant 2 Bar" };
      tenant3 = { ...getMockTenant(), name: "Tenant 3 FooBar" };
      tenant4 = { ...getMockTenant(), name: "Tenant 4 Baz" };
      tenant5 = { ...getMockTenant(), name: "Tenant 5 BazBar" };
      tenant6 = { ...getMockTenant(), name: "Tenant 6 BazFoo" };

      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneTenant(tenant4);
      await addOneTenant(tenant5);
      await addOneTenant(tenant6);

      const agreement1 = {
        ...getMockAgreement(),
        producerId: tenant1.id,
        consumerId: tenant2.id,
      };

      const agreement2 = {
        ...getMockAgreement(),
        producerId: tenant1.id,
        consumerId: tenant3.id,
      };

      const agreement3 = {
        ...getMockAgreement(),
        producerId: tenant2.id,
        consumerId: tenant4.id,
      };

      const agreement4 = {
        ...getMockAgreement(),
        producerId: tenant2.id,
        consumerId: tenant5.id,
      };

      const agreement5 = {
        ...getMockAgreement(),
        producerId: tenant3.id,
        consumerId: tenant6.id,
      };

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);
      await addOneAgreement(agreement3);
      await addOneAgreement(agreement4);
      await addOneAgreement(agreement5);
    });
    describe("get agreement consumers", () => {
      it("should get all agreement consumers", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          undefined,
          10,
          0,
          genericLogger
        );

        expect(consumers).toEqual({
          totalCount: 5,
          results: expect.arrayContaining(
            [tenant2, tenant3, tenant4, tenant5, tenant6].map(
              toCompactOrganization
            )
          ),
        });
      });
      it("should get agreement consumers filtered by name", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          "Foo",
          10,
          0,
          genericLogger
        );

        expect(consumers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining(
            [tenant3, tenant6].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement consumers with limit", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          undefined,
          2,
          0,
          genericLogger
        );

        expect(consumers).toEqual({
          totalCount: 5,
          results: expect.arrayContaining(
            [tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement consumers with offset and limit", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          undefined,
          2,
          1,
          genericLogger
        );

        expect(consumers).toEqual({
          totalCount: 5,
          results: expect.arrayContaining(
            [tenant3, tenant4].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement consumers with offset, limit, and name filter", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          "Foo",
          1,
          1,
          genericLogger
        );

        expect(consumers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining([tenant6].map(toCompactOrganization)),
        });
      });
      it("should get no agreement consumers in case no filters match", async () => {
        const producers = await agreementService.getAgreementConsumers(
          "Not existing name",
          10,
          0,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 0,
          results: [],
        });
      });
    });
    describe("get agreement producers", () => {
      it("should get all agreement producers", async () => {
        const producers = await agreementService.getAgreementProducers(
          undefined,
          10,
          0,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 3,
          results: expect.arrayContaining(
            [tenant1, tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers filtered by name", async () => {
        const producers = await agreementService.getAgreementProducers(
          "Bar",
          10,
          0,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining(
            [tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers with limit", async () => {
        const producers = await agreementService.getAgreementProducers(
          undefined,
          2,
          0,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 3,
          results: expect.arrayContaining(
            [tenant1, tenant2].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers with offset and limit", async () => {
        const producers = await agreementService.getAgreementProducers(
          undefined,
          2,
          1,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 3,
          results: expect.arrayContaining(
            [tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers with offset, limit, and name filter", async () => {
        const producers = await agreementService.getAgreementProducers(
          "Bar",
          1,
          1,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining([tenant3].map(toCompactOrganization)),
        });
      });
      it("should get no agreement producers in case no filters match", async () => {
        const producers = await agreementService.getAgreementProducers(
          "Not existing name",
          10,
          0,
          genericLogger
        );

        expect(producers).toEqual({
          totalCount: 0,
          results: [],
        });
      });
    });
  });
  describe("get agreement eservices", () => {
    let eservice1: EService;
    let eservice2: EService;
    let eservice3: EService;

    let tenant1: Tenant;
    let tenant2: Tenant;
    let tenant3: Tenant;

    const toCompactEService = (eservice: EService): CompactEService => ({
      id: eservice.id,
      name: eservice.name,
    });

    beforeEach(async () => {
      tenant1 = getMockTenant();
      tenant2 = getMockTenant();
      tenant3 = getMockTenant();

      eservice1 = {
        ...getMockEService(generateId<EServiceId>(), tenant1.id),
        name: "EService 1 Foo",
      };
      eservice2 = {
        ...getMockEService(generateId<EServiceId>(), tenant2.id),
        name: "EService 2 Bar",
      };
      eservice3 = {
        ...getMockEService(generateId<EServiceId>(), tenant3.id),
        name: "EService 3 FooBar",
      };

      await addOneTenant(tenant1);
      await addOneTenant(tenant2);
      await addOneTenant(tenant3);
      await addOneEService(eservice1);
      await addOneEService(eservice2);
      await addOneEService(eservice3);

      const agreement1 = {
        ...getMockAgreement(eservice1.id),
        producerId: eservice1.producerId,
        consumerId: tenant2.id,
        state: agreementState.draft,
      };
      const agreement2 = {
        ...getMockAgreement(eservice2.id),
        producerId: eservice2.producerId,
        consumerId: tenant3.id,
        state: agreementState.active,
      };

      const agreement3 = {
        ...getMockAgreement(eservice3.id),
        producerId: eservice3.producerId,
        consumerId: tenant1.id,
        state: agreementState.pending,
      };

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);
      await addOneAgreement(agreement3);
    });

    it("should get all agreement eservices", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
          agreeementStates: [],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 3,
        results: expect.arrayContaining(
          [eservice1, eservice2, eservice3].map(toCompactEService)
        ),
      });
    });

    it("should get agreement eservices filtered by name", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: "Foo",
          consumerIds: [],
          producerIds: [],
          agreeementStates: [],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 2,
        results: expect.arrayContaining(
          [eservice1, eservice3].map(toCompactEService)
        ),
      });
    });

    it("should get agreement eservices filtered by consumerId", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: undefined,
          consumerIds: [tenant2.id, tenant3.id],
          producerIds: [],
          agreeementStates: [],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 2,
        results: expect.arrayContaining(
          [eservice1, eservice2].map(toCompactEService)
        ),
      });
    });

    it("should get agreement eservices filtered by producerId", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [tenant1.id, tenant2.id],
          agreeementStates: [],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 2,
        results: expect.arrayContaining(
          [eservice1, eservice2].map(toCompactEService)
        ),
      });
    });

    it("should get agreement eservices filtered by agreement state", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
          agreeementStates: [agreementState.active, agreementState.pending],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 2,
        results: expect.arrayContaining(
          [eservice2, eservice3].map(toCompactEService)
        ),
      });
    });

    it("should get agreement eservices with filters: name, consumerId, producerId", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: "Foo",
          consumerIds: [tenant2.id],
          producerIds: [tenant1.id],
          agreeementStates: [],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([eservice1].map(toCompactEService)),
      });
    });

    it("should get agreement eservices with filters: name, agreement state", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: "Bar",
          consumerIds: [],
          producerIds: [],
          agreeementStates: [agreementState.pending, agreementState.draft],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([eservice3].map(toCompactEService)),
      });
    });

    it("should get agreement eservices with filters: name, consumerId, producerId, agreement state", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: "Bar",
          consumerIds: [tenant1.id],
          producerIds: [tenant3.id],
          agreeementStates: [agreementState.pending],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([eservice3].map(toCompactEService)),
      });
    });

    it("should get agreement eservices with limit", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
          agreeementStates: [],
        },
        2,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 3,
        results: expect.arrayContaining(
          [eservice1, eservice2].map(toCompactEService)
        ),
      });
    });

    it("should get agreement eservices with offset and limit", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
          agreeementStates: [],
        },
        2,
        1,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 3,
        results: expect.arrayContaining(
          [eservice2, eservice3].map(toCompactEService)
        ),
      });
    });

    it("should get no agreement eservices in case no filters match", async () => {
      const eservices = await agreementService.getAgreementEServices(
        {
          eserviceName: "Not existing name",
          consumerIds: [],
          producerIds: [],
          agreeementStates: [],
        },
        10,
        0,
        genericLogger
      );

      expect(eservices).toEqual({
        totalCount: 0,
        results: [],
      });
    });
  });
});
