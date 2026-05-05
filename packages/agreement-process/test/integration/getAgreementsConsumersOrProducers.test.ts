/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockAgreement,
  getMockAuthData,
  getMockDelegation,
  getMockEService,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  Tenant,
  delegationKind,
  delegationState,
  generateId,
  CompactOrganization,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import {
  addOneTenant,
  addOneAgreement,
  agreementService,
  addOneDelegation,
  expectGenericSinglePageListResult,
} from "../integrationUtils.js";

describe("get agreements consumers / producers", () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let tenant4: Tenant;
  let tenant5: Tenant;
  let tenant6: Tenant;
  let delegateProducer1: Tenant;
  let delegateConsumer1: Tenant;
  let delegateConsumer2: Tenant;

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
    delegateConsumer1 = {
      ...getMockTenant(),
      name: "Tenant Delegate Consumer 1 Bar",
    };
    delegateConsumer2 = {
      ...getMockTenant(),
      name: "Tenant Delegate Consumer 2 Foo",
    };
    delegateProducer1 = {
      ...getMockTenant(),
      name: "Tenant Delegate Producer 1",
    };

    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    await addOneTenant(tenant4);
    await addOneTenant(tenant5);
    await addOneTenant(tenant6);
    await addOneTenant(delegateConsumer1);
    await addOneTenant(delegateConsumer2);
    await addOneTenant(delegateProducer1);

    const eservice1 = {
      ...getMockEService(generateId<EServiceId>(), tenant1.id),
      name: "EService 1 Foo",
    };
    const eservice2 = {
      ...getMockEService(generateId<EServiceId>(), tenant2.id),
      name: "EService 2 Bar",
    };
    const eservice3 = {
      ...getMockEService(generateId<EServiceId>(), tenant3.id),
      name: "EService 3 FooBar",
    };
    const eservice4 = {
      ...getMockEService(generateId<EServiceId>(), tenant4.id),
      name: "EService 4 FooBar",
    };

    const agreement1 = {
      ...getMockAgreement(eservice1.id),
      producerId: eservice1.producerId,
      consumerId: tenant2.id,
    };

    const agreement2 = {
      ...getMockAgreement(eservice2.id),
      producerId: eservice2.producerId,
      consumerId: tenant3.id,
    };

    const agreement3 = {
      ...getMockAgreement(eservice3.id),
      producerId: eservice3.producerId,
      consumerId: tenant4.id,
    };

    const agreement4 = {
      ...getMockAgreement(eservice4.id),
      producerId: eservice4.producerId,
      consumerId: tenant5.id,
    };

    const agreement5 = {
      ...getMockAgreement(eservice3.id),
      producerId: eservice3.producerId,
      consumerId: tenant6.id,
    };

    const agreement6 = {
      ...getMockAgreement(eservice3.id),
      producerId: eservice3.producerId,
      consumerId: delegateProducer1.id,
    };

    const agreement7 = {
      ...getMockAgreement(eservice4.id),
      producerId: eservice4.producerId,
      consumerId: delegateConsumer1.id,
    };

    const agreement8 = {
      ...getMockAgreement(eservice4.id),
      producerId: eservice4.producerId,
      consumerId: delegateConsumer2.id,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);
    await addOneAgreement(agreement5);
    await addOneAgreement(agreement6);
    await addOneAgreement(agreement7);
    await addOneAgreement(agreement8);

    const producerDelegation1 = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegateId: delegateProducer1.id,
      delegatorId: eservice1.producerId,
      eserviceId: eservice1.id,
      state: delegationState.active,
    });
    const consumerDelegation1 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: delegateConsumer1.id,
      delegatorId: tenant3.id,
      eserviceId: eservice2.id,
      state: delegationState.active,
    });
    const consumerDelegation2 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: delegateConsumer2.id,
      delegatorId: tenant4.id,
      eserviceId: eservice3.id,
      state: delegationState.active,
    });

    // These delegations are revoked: the delegates
    // should not see the corresponding agreements
    const revokedProducerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegateId: delegateProducer1.id,
      delegatorId: eservice2.producerId,
      eserviceId: eservice2.id,
      state: delegationState.revoked,
    });
    const revokedConsumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: delegateConsumer1.id,
      delegatorId: tenant2.id,
      eserviceId: eservice3.id,
      state: delegationState.revoked,
    });

    await addOneDelegation(producerDelegation1);
    await addOneDelegation(consumerDelegation1);
    await addOneDelegation(consumerDelegation2);
    await addOneDelegation(revokedProducerDelegation);
    await addOneDelegation(revokedConsumerDelegation);
  });
  describe("get agreements consumers", () => {
    it("should get all agreements consumers for agreements visible to consumer/producer requester if no filters are provided", async () => {
      const consumersResultForTenant1 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant1.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForTenant1,
        [tenant2].map(toCompactOrganization)
      );

      const consumersResultForTenant2 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant2.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForTenant2,
        [tenant2, tenant3].map(toCompactOrganization)
      );

      const consumersResultForTenant3 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant3.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForTenant3,
        [tenant3, tenant4, tenant6, delegateProducer1].map(
          toCompactOrganization
        )
      );

      const consumersResultForTenant4 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant4.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForTenant4,
        [tenant4, tenant5, delegateConsumer1, delegateConsumer2].map(
          toCompactOrganization
        )
      );

      const consumersResultForTenant5 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant5.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForTenant5,
        [tenant5].map(toCompactOrganization)
      );

      const consumersResultForTenant6 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant6.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForTenant6,
        [tenant6].map(toCompactOrganization)
      );
    });

    it("should get all agreements consumers for agreements visible to delegate producer requester if no filters are provided", async () => {
      const consumersResultForDelegateProducer1 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(delegateProducer1.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForDelegateProducer1,
        [tenant2, delegateProducer1].map(toCompactOrganization)
      );
    });

    it("should get all agreements consumers for agreements visible to delegate consumer requester if no filters are provided", async () => {
      const consumersResultForDelegateConsumer1 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(delegateConsumer1.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForDelegateConsumer1,
        [tenant3, delegateConsumer1].map(toCompactOrganization)
      );

      const consumersResultForDelegateConsumer2 =
        await agreementService.getAgreementsConsumers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(delegateConsumer2.id) })
        );

      expectGenericSinglePageListResult(
        consumersResultForDelegateConsumer2,
        [tenant4, delegateConsumer2].map(toCompactOrganization)
      );
    });

    it("should get agreements consumers filtered by name", async () => {
      const consumers = await agreementService.getAgreementsConsumers(
        "Bar",
        10,
        0,
        getMockContext({ authData: getMockAuthData(tenant4.id) })
      );

      expectGenericSinglePageListResult(
        consumers,
        [tenant5, delegateConsumer1].map(toCompactOrganization)
      );
    });

    it("should get agreements consumers with limit", async () => {
      const consumers = await agreementService.getAgreementsConsumers(
        undefined,
        2,
        0,
        getMockContext({ authData: getMockAuthData(tenant4.id) })
      );

      expect(consumers).toEqual({
        totalCount: 4,
        results: [tenant4, tenant5].map(toCompactOrganization),
      });
    });

    it("should get agreements consumers with offset and limit", async () => {
      const consumers = await agreementService.getAgreementsConsumers(
        undefined,
        2,
        1,
        getMockContext({ authData: getMockAuthData(tenant4.id) })
      );

      expect(consumers).toEqual({
        totalCount: 4,
        results: [tenant5, delegateConsumer1].map(toCompactOrganization),
      });
    });

    it("should get agreements consumers with offset, limit, and name filter", async () => {
      const consumers = await agreementService.getAgreementsConsumers(
        "B",
        1,
        1,
        getMockContext({ authData: getMockAuthData(tenant4.id) })
      );

      expect(consumers).toEqual({
        totalCount: 3,
        results: [tenant5].map(toCompactOrganization),
      });
    });

    it("should get no agreements consumers in case no filters match", async () => {
      const producers = await agreementService.getAgreementsConsumers(
        "Not existing name",
        10,
        0,
        getMockContext({ authData: getMockAuthData(tenant1.id) })
      );

      expect(producers).toEqual({
        totalCount: 0,
        results: [],
      });
    });
  });
  describe("get agreements producers", () => {
    it("should get all agreements producers for agreements visible to consumer/producer requester if no filters are provided", async () => {
      const producerResultsForTenant1 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant1.id) })
        );

      expectGenericSinglePageListResult(
        producerResultsForTenant1,
        [tenant1].map(toCompactOrganization)
      );

      const producerResultsForTenant2 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant2.id) })
        );

      expectGenericSinglePageListResult(
        producerResultsForTenant2,
        [tenant1, tenant2].map(toCompactOrganization)
      );

      const producerResultsForTenant3 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant3.id) })
        );

      expectGenericSinglePageListResult(
        producerResultsForTenant3,
        [tenant2, tenant3].map(toCompactOrganization)
      );

      const producerResultsForTenant4 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant4.id) })
        );

      expectGenericSinglePageListResult(
        producerResultsForTenant4,
        [tenant3, tenant4].map(toCompactOrganization)
      );

      const producerResultsForTenant5 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant5.id) })
        );

      expectGenericSinglePageListResult(
        producerResultsForTenant5,
        [tenant4].map(toCompactOrganization)
      );

      const producerResultsForTenant6 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenant6.id) })
        );

      expectGenericSinglePageListResult(
        producerResultsForTenant6,
        [tenant3].map(toCompactOrganization)
      );
    });

    it("should get all agreements producers for agreements visible to delegate producer requester if no filters are provided", async () => {
      const producersResultForDelegateProducer1 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(delegateProducer1.id) })
        );

      expectGenericSinglePageListResult(
        producersResultForDelegateProducer1,
        [tenant3, tenant1].map(toCompactOrganization)
      );
    });

    it("should get all agreements producers for agreements visible to delegate consumer requester if no filters are provided", async () => {
      const producersResultForDelegateConsumer1 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(delegateConsumer1.id) })
        );

      expectGenericSinglePageListResult(
        producersResultForDelegateConsumer1,
        [tenant2, tenant4].map(toCompactOrganization)
      );

      const producersResultForDelegateConsumer2 =
        await agreementService.getAgreementsProducers(
          undefined,
          10,
          0,
          getMockContext({ authData: getMockAuthData(delegateConsumer2.id) })
        );

      expectGenericSinglePageListResult(
        producersResultForDelegateConsumer2,
        [tenant3, tenant4].map(toCompactOrganization)
      );
    });

    it("should get agreements producers filtered by name", async () => {
      const producers = await agreementService.getAgreementsProducers(
        "Bar",
        10,
        0,
        getMockContext({ authData: getMockAuthData(tenant2.id) })
      );

      expectGenericSinglePageListResult(
        producers,
        [tenant2].map(toCompactOrganization)
      );
    });
    it("should get agreements producers with limit", async () => {
      const producers = await agreementService.getAgreementsProducers(
        undefined,
        1,
        0,
        getMockContext({ authData: getMockAuthData(tenant2.id) })
      );

      expect(producers).toEqual({
        totalCount: 2,
        results: [tenant1].map(toCompactOrganization),
      });
    });

    it("should get agreements producers with offset and limit", async () => {
      const producers = await agreementService.getAgreementsProducers(
        undefined,
        1,
        1,
        getMockContext({ authData: getMockAuthData(tenant2.id) })
      );

      expect(producers).toEqual({
        totalCount: 2,
        results: [tenant2].map(toCompactOrganization),
      });
    });

    it("should get agreements producers with offset, limit, and name filter", async () => {
      const producers = await agreementService.getAgreementsProducers(
        "Bar",
        1,
        0,
        getMockContext({ authData: getMockAuthData(tenant2.id) })
      );

      expect(producers).toEqual({
        totalCount: 1,
        results: [tenant2].map(toCompactOrganization),
      });
    });

    it("should get no agreements producers in case no filters match", async () => {
      const producers = await agreementService.getAgreementsProducers(
        "Not existing name",
        10,
        0,
        getMockContext({ authData: getMockAuthData(tenant1.id) })
      );

      expect(producers).toEqual({
        totalCount: 0,
        results: [],
      });
    });
  });
});
