/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockEService,
  getMockAgreement,
  getMockAuthData,
  getMockDelegation,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  EService,
  Tenant,
  generateId,
  EServiceId,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { CompactEService } from "../src/model/domain/models.js";
import {
  addOneTenant,
  addOneEService,
  addOneAgreement,
  agreementService,
  addOneDelegation,
  expectGenericSinglePageListResult,
} from "./utils.js";

describe("get agreements eservices", () => {
  let eservice1: EService;
  let eservice2: EService;
  let eservice3: EService;
  let eservice4: EService;

  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let delegateProducer1: Tenant;
  let delegateConsumer1: Tenant;
  let delegateConsumer2: Tenant;

  const toCompactEService = (eservice: EService): CompactEService => ({
    id: eservice.id,
    name: eservice.name,
  });

  beforeEach(async () => {
    tenant1 = getMockTenant();
    tenant2 = getMockTenant();
    tenant3 = getMockTenant();
    delegateProducer1 = getMockTenant();
    delegateConsumer1 = getMockTenant();
    delegateConsumer2 = getMockTenant();

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
    eservice4 = {
      ...getMockEService(generateId<EServiceId>(), tenant3.id),
      name: "EService 4 FooBar",
    };

    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    await addOneTenant(delegateProducer1);
    await addOneTenant(delegateConsumer1);
    await addOneTenant(delegateConsumer2);
    await addOneEService(eservice1);
    await addOneEService(eservice2);
    await addOneEService(eservice3);
    await addOneEService(eservice4);

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
      consumerId: tenant1.id,
    };
    const agreement4 = {
      ...getMockAgreement(eservice4.id),
      producerId: eservice4.producerId,
      consumerId: tenant3.id,
    };

    const agreement5 = {
      ...getMockAgreement(eservice4.id),
      consumerId: delegateProducer1.id,
      producerId: eservice4.producerId,
    };

    const agreement6 = {
      ...getMockAgreement(eservice4.id),
      producerId: eservice4.producerId,
      consumerId: delegateConsumer1.id,
    };

    const agreement7 = {
      ...getMockAgreement(eservice2.id),
      producerId: eservice2.producerId,
      consumerId: delegateConsumer2.id,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);
    await addOneAgreement(agreement5);
    await addOneAgreement(agreement6);
    await addOneAgreement(agreement7);

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
      delegatorId: tenant1.id,
      eserviceId: eservice3.id,
      state: delegationState.active,
    });
    const consumerDelegation2 = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: delegateConsumer2.id,
      delegatorId: tenant2.id,
      eserviceId: eservice1.id,
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

  it("should get all agreements eservices for agreements visible to consumer/producer requester if no filters are provided", async () => {
    const resultsForTenant1 = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        consumerIds: [],
        producerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );

    expectGenericSinglePageListResult(
      resultsForTenant1,
      [eservice1, eservice3].map(toCompactEService)
    );

    const resultsForTenant2 = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        consumerIds: [],
        producerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant2.id) })
    );

    expectGenericSinglePageListResult(
      resultsForTenant2,
      [eservice1, eservice2].map(toCompactEService)
    );

    const resultsForTenant3 = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        consumerIds: [],
        producerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );

    expectGenericSinglePageListResult(
      resultsForTenant3,
      [eservice2, eservice3, eservice4].map(toCompactEService)
    );
  });

  it("should get all agreements eservices for agreements visible to delegate producer requester if no filters are provided", async () => {
    const resultsForDelegateProducer1 =
      await agreementService.getAgreementsEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
        },
        10,
        0,
        getMockContext({ authData: getMockAuthData(delegateProducer1.id) })
      );
    expectGenericSinglePageListResult(
      resultsForDelegateProducer1,
      [eservice1, eservice4].map(toCompactEService)
    );
  });

  it("should get all agreements eservices for agreements visible to delegate consumer requester if no filters are provided", async () => {
    const resultsForDelegateConsumer1 =
      await agreementService.getAgreementsEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
        },
        10,
        0,
        getMockContext({ authData: getMockAuthData(delegateConsumer1.id) })
      );
    expectGenericSinglePageListResult(
      resultsForDelegateConsumer1,
      [eservice3, eservice4].map(toCompactEService)
    );

    const resultsForDelegateConsumer2 =
      await agreementService.getAgreementsEServices(
        {
          eserviceName: undefined,
          consumerIds: [],
          producerIds: [],
        },
        10,
        0,
        getMockContext({ authData: getMockAuthData(delegateConsumer2.id) })
      );
    expectGenericSinglePageListResult(
      resultsForDelegateConsumer2,
      [eservice1, eservice2].map(toCompactEService)
    );
  });

  it("should get agreements eservices filtered by name", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: "Foo",
        consumerIds: [],
        producerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );

    expectGenericSinglePageListResult(
      eservices,
      [eservice3, eservice4].map(toCompactEService)
    );
  });

  it("should get agreements eservices filtered by consumerId", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        consumerIds: [delegateConsumer1.id, tenant2.id],
        producerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );

    expectGenericSinglePageListResult(
      eservices,
      [eservice3, eservice4].map(toCompactEService)
    );
  });

  it("should get agreements eservices filtered by producerId", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        producerIds: [tenant1.id],
        consumerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant2.id) })
    );

    expectGenericSinglePageListResult(
      eservices,
      [eservice1].map(toCompactEService)
    );
  });

  it("should get agreements eservices with filters: name, consumerId, producerId", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: "Foo",
        consumerIds: [tenant2.id],
        producerIds: [tenant1.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );

    expect(eservices).toEqual({
      totalCount: 1,
      results: [eservice1].map(toCompactEService),
    });
  });

  it("should get agreements eservices with limit", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        consumerIds: [],
        producerIds: [],
      },
      2,
      0,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );

    expect(eservices).toEqual({
      totalCount: 3,
      results: [eservice2, eservice3].map(toCompactEService),
    });
  });

  it("should get agreements eservices with offset and limit", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        consumerIds: [],
        producerIds: [],
      },
      2,
      1,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );

    expect(eservices).toEqual({
      totalCount: 3,
      results: [eservice3, eservice4].map(toCompactEService),
    });
  });

  it("should get no agreements eservices in case no filters match", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: "Not existing name",
        consumerIds: [],
        producerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );

    expectGenericSinglePageListResult(eservices, []);
  });

  it("should get agreement eservice for a delegated eservice with filters: producerId", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        producerIds: [delegateProducer1.id],
        consumerIds: [],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant2.id) })
    );

    expectGenericSinglePageListResult(
      eservices,
      [eservice1].map(toCompactEService)
    );
  });

  it("should get agreement eservice for a delegated agreement with filters: consumerId", async () => {
    const eservices = await agreementService.getAgreementsEServices(
      {
        eserviceName: undefined,
        producerIds: [],
        consumerIds: [delegateConsumer1.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );

    expectGenericSinglePageListResult(
      eservices,
      [eservice3, eservice4].map(toCompactEService)
    );
  });
});
