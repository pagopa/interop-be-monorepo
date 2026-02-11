/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockEService,
  getMockAgreement,
  getMockDelegation,
  getMockAuthData,
  getMockContext,
  getMockDescriptorPublished,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  Descriptor,
  EService,
  AgreementAttribute,
  Agreement,
  descriptorState,
  generateId,
  EServiceId,
  agreementState,
  delegationKind,
  delegationState,
  TenantId,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import {
  addOneTenant,
  addOneEService,
  addOneAgreement,
  agreementService,
  addOneDelegation,
  expectSinglePageListResult,
  sortListAgreements,
} from "../integrationUtils.js";

describe("get agreements", () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let delegateProducer1: Tenant;
  let delegateConsumer1: Tenant;
  let delegateConsumer2: Tenant;
  let descriptor1: Descriptor;
  let descriptor2: Descriptor;
  let descriptor3: Descriptor;
  let descriptor4: Descriptor;
  let descriptor5: Descriptor;
  let descriptor6: Descriptor;
  let eservice1: EService;
  let eservice2: EService;
  let eservice3: EService;
  let eservice4: EService;
  let attribute1: AgreementAttribute;
  let attribute2: AgreementAttribute;
  let attribute3: AgreementAttribute;
  let attribute4: AgreementAttribute;
  let agreement1: Agreement;
  let agreement2: Agreement;
  let agreement3: Agreement;
  let agreement4: Agreement;
  let agreement5: Agreement;
  let agreement6: Agreement;
  let agreement7: Agreement;
  let agreement8: Agreement;
  let agreement9: Agreement;
  let agreement10: Agreement;

  beforeEach(async () => {
    tenant1 = getMockTenant();
    tenant2 = getMockTenant();
    tenant3 = getMockTenant();
    delegateProducer1 = getMockTenant();
    delegateConsumer1 = getMockTenant();
    delegateConsumer2 = getMockTenant();

    descriptor1 = {
      ...getMockDescriptorPublished(),
      state: descriptorState.suspended,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    descriptor2 = {
      ...getMockDescriptorPublished(),
      publishedAt: new Date(),
    };
    descriptor3 = {
      ...getMockDescriptorPublished(),
      publishedAt: new Date(Date.now()),
    };
    descriptor4 = {
      ...getMockDescriptorPublished(),
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    descriptor5 = getMockDescriptorPublished();
    descriptor6 = getMockDescriptorPublished();
    eservice1 = {
      ...getMockEService(generateId<EServiceId>(), tenant1.id, [
        descriptor1,
        descriptor2,
        // descriptor2 is the latest - agreements for descriptor1 are upgradeable
      ]),
      name: "EService1", // Adding name because results are sorted by esevice name
    };
    eservice2 = {
      ...getMockEService(generateId<EServiceId>(), tenant2.id, [
        descriptor3,
        descriptor4,
        // descriptor4 is not the latest - agreements for descriptor3 are not upgradeable
      ]),
      name: "EService2", // Adding name because results are sorted by esevice name
    };
    eservice3 = {
      ...getMockEService(generateId<EServiceId>(), tenant3.id, [descriptor5]),
      name: "EService3", // Adding name because results are sorted by eservice name
    };
    eservice4 = {
      ...getMockEService(generateId<EServiceId>(), tenant3.id, [descriptor6]),
      name: "EService4", // Adding name because results are sorted by eservice name
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

    attribute1 = { id: generateId() };
    attribute2 = { id: generateId() };
    attribute3 = { id: generateId() };
    attribute4 = { id: generateId() };
    agreement1 = {
      ...getMockAgreement(eservice1.id, tenant1.id, agreementState.draft),
      descriptorId: eservice1.descriptors[0].id,
      producerId: eservice1.producerId,
      certifiedAttributes: [attribute1, attribute2],
      declaredAttributes: [attribute3],
    };

    agreement2 = {
      ...getMockAgreement(eservice1.id, tenant2.id, agreementState.active),
      descriptorId: eservice1.descriptors[1].id,
      producerId: eservice1.producerId,
      declaredAttributes: [attribute3],
      verifiedAttributes: [attribute4],
    };

    agreement3 = {
      ...getMockAgreement(eservice2.id, tenant1.id, agreementState.pending),
      descriptorId: eservice2.descriptors[0].id,
      producerId: eservice2.producerId,
    };

    agreement4 = {
      ...getMockAgreement(
        eservice2.id,
        tenant2.id,
        agreementState.missingCertifiedAttributes
      ),
      // upgradeable agreement based on descriptors, but not in an upgradeable state
      descriptorId: eservice2.descriptors[1].id,
      producerId: eservice2.producerId,
    };

    agreement5 = {
      ...getMockAgreement(eservice3.id, tenant1.id, agreementState.archived),
      descriptorId: eservice3.descriptors[0].id,
      producerId: eservice3.producerId,
    };

    agreement6 = {
      ...getMockAgreement(eservice3.id, tenant3.id, agreementState.rejected),
      descriptorId: eservice3.descriptors[0].id,
      producerId: eservice3.producerId,
    };

    agreement7 = {
      ...getMockAgreement(eservice4.id, tenant1.id, agreementState.draft),
      descriptorId: eservice4.descriptors[0].id,
      producerId: eservice4.producerId,
    };

    agreement8 = {
      ...getMockAgreement(
        eservice4.id,
        delegateProducer1.id,
        agreementState.active
      ),
      descriptorId: eservice4.descriptors[0].id,
      producerId: eservice4.producerId,
    };

    agreement9 = {
      ...getMockAgreement(
        eservice4.id,
        delegateConsumer1.id,
        agreementState.active
      ),
      descriptorId: eservice4.descriptors[0].id,
      producerId: eservice4.producerId,
    };

    agreement10 = {
      ...getMockAgreement(
        eservice4.id,
        delegateConsumer2.id,
        agreementState.active
      ),
      descriptorId: eservice4.descriptors[0].id,
      producerId: eservice4.producerId,
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);
    await addOneAgreement(agreement3);
    await addOneAgreement(agreement4);
    await addOneAgreement(agreement5);
    await addOneAgreement(agreement6);
    await addOneAgreement(agreement7);
    await addOneAgreement(agreement8);
    await addOneAgreement(agreement9);
    await addOneAgreement(agreement10);

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
      delegatorId: tenant3.id,
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

  it("should get all agreements visible to consumer/producer requester if no filters are provided", async () => {
    const allAgreementsVisibleToTenant1 = await agreementService.getAgreements(
      {},
      20,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(allAgreementsVisibleToTenant1, [
      agreement1,
      agreement2,
      agreement3,
      agreement5,
      agreement7,
    ]);

    const allAgreementsVisibleToTenant2 = await agreementService.getAgreements(
      {},
      20,
      0,
      getMockContext({ authData: getMockAuthData(tenant2.id) })
    );
    expectSinglePageListResult(allAgreementsVisibleToTenant2, [
      agreement2,
      agreement3,
      agreement4,
    ]);

    const allAgreementsVisibleToTenant3 = await agreementService.getAgreements(
      {},
      20,
      0,
      getMockContext({ authData: getMockAuthData(tenant3.id) })
    );
    expectSinglePageListResult(allAgreementsVisibleToTenant3, [
      agreement5,
      agreement6,
      agreement7,
      agreement8,
      agreement9,
      agreement10,
    ]);
  });

  it("should get all agreements visible to delegate producer requester if no filters are provided", async () => {
    const allAgreementsVisibleToDelegateProducer1 =
      await agreementService.getAgreements(
        {},
        20,
        0,
        getMockContext({ authData: getMockAuthData(delegateProducer1.id) })
      );
    expectSinglePageListResult(allAgreementsVisibleToDelegateProducer1, [
      agreement1,
      agreement2,
      agreement8,
    ]);
  });

  it("should get all agreements visible to delegate consumer requester if no filters are provided", async () => {
    const allAgreementsVisibleToDelegateConsumer1 =
      await agreementService.getAgreements(
        {},
        20,
        0,
        getMockContext({ authData: getMockAuthData(delegateConsumer1.id) })
      );

    expectSinglePageListResult(allAgreementsVisibleToDelegateConsumer1, [
      agreement5,
      agreement9,
    ]);

    const allAgreementsVisibleToDelegateConsumer2 =
      await agreementService.getAgreements(
        {},
        20,
        0,
        getMockContext({ authData: getMockAuthData(delegateConsumer2.id) })
      );
    expectSinglePageListResult(allAgreementsVisibleToDelegateConsumer2, [
      agreement6,
      agreement10,
    ]);
  });

  it("should get agreements with filters: producerId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        producerId: eservice1.producerId,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements1, [agreement1, agreement2]);

    const agreements2 = await agreementService.getAgreements(
      {
        producerId: [eservice1.producerId, eservice2.producerId],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements2, [
      agreement1,
      agreement2,
      agreement3,
    ]);
  });

  it("should get agreements with filters: consumerId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        consumerId: tenant1.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements1, [
      agreement1,
      agreement3,
      agreement5,
      agreement7,
    ]);

    const agreements2 = await agreementService.getAgreements(
      {
        consumerId: [tenant1.id, tenant2.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements2, [
      agreement1,
      agreement2,
      agreement3,
      agreement5,
      agreement7,
    ]);
  });

  it("should get agreements with filters: eserviceId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        eserviceId: eservice1.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements1, [agreement1, agreement2]);

    const agreements2 = await agreementService.getAgreements(
      {
        eserviceId: [eservice1.id, eservice2.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements2, [
      agreement1,
      agreement2,
      agreement3,
    ]);
  });

  it("should get agreements with filters: descriptorId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        descriptorId: descriptor1.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements1, [agreement1]);

    const agreements2 = await agreementService.getAgreements(
      {
        descriptorId: [descriptor1.id, descriptor3.id, descriptor5.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements2, [
      agreement1,
      agreement3,
      agreement5,
    ]);
  });

  it("should get agreements with filters: attributeId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        attributeId: attribute2.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements1, [agreement1]);

    const agreements2 = await agreementService.getAgreements(
      {
        attributeId: attribute3.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements2, [agreement1, agreement2]);

    const agreements3 = await agreementService.getAgreements(
      {
        attributeId: [attribute1.id, attribute3.id, attribute4.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements3, [agreement1, agreement2]);
  });

  it("should get agreements with filters: state", async () => {
    const agreements = await agreementService.getAgreements(
      {
        agreementStates: [agreementState.active, agreementState.pending],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements, [agreement2, agreement3]);
  });

  it("should get agreements with filters: showOnlyUpgradeable", async () => {
    const agreements = await agreementService.getAgreements(
      {
        showOnlyUpgradeable: true,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements, [
      agreement1,
      // also agreement4 could upgrade to newer descriptor but it is not in an upgradeable state
    ]);
  });

  it("should get agreements with filters: producerId, consumerId, eserviceId", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: [eservice1.producerId, eservice2.producerId],
        consumerId: tenant1.id,
        eserviceId: [eservice1.id, eservice2.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements, [agreement1, agreement3]);
  });

  it("should get agreements with filters: producerId, consumerId, eserviceId, descriptorId", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: [eservice1.producerId, eservice2.producerId],
        consumerId: tenant1.id,
        eserviceId: [eservice1.id, eservice2.id],
        descriptorId: [descriptor1.id],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements, [agreement1]);
  });

  it("should get agreements with filters: attributeId, state", async () => {
    const agreements = await agreementService.getAgreements(
      {
        attributeId: attribute3.id,
        agreementStates: [agreementState.active],
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements, [agreement2]);
  });

  it("should get agreements with filters: showOnlyUpgradeable, state, descriptorId", async () => {
    const agreements1 = await agreementService.getAgreements(
      {
        showOnlyUpgradeable: true,
        agreementStates: [agreementState.draft],
        descriptorId: descriptor1.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements1, [agreement1]);

    const agreements2 = await agreementService.getAgreements(
      {
        showOnlyUpgradeable: true,
        agreementStates: [agreementState.suspended],
        descriptorId: descriptor1.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expectSinglePageListResult(agreements2, []);
  });

  it("should get agreements with limit", async () => {
    const agreements = await agreementService.getAgreements(
      {},
      2,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expect({
      totalCount: agreements.totalCount,
      results: sortListAgreements(agreements.results),
    }).toEqual({
      totalCount: 5,
      results: sortListAgreements([agreement1, agreement2]),
    });
  });

  it("should get agreements with offset and limit", async () => {
    const agreements = await agreementService.getAgreements(
      {},
      2,
      2,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );
    expect({
      totalCount: agreements.totalCount,
      results: sortListAgreements(agreements.results),
    }).toEqual({
      totalCount: 5,
      results: sortListAgreements([agreement3, agreement5]),
    });
  });

  it("should get no agreements in case no filters match", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: generateId<TenantId>(),
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(tenant1.id) })
    );

    expect(agreements).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get agreements for a delegated eservice with filters: producerId and requester is producer delegate", async () => {
    const agreements = await agreementService.getAgreements(
      {
        producerId: eservice1.producerId,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(delegateProducer1.id) })
    );
    expectSinglePageListResult(agreements, [agreement1, agreement2]);
  });

  it("should get agreements for a delegated eservice with filters: consumerId and requester is consumer delegate", async () => {
    const agreements = await agreementService.getAgreements(
      {
        consumerId: tenant1.id,
      },
      10,
      0,
      getMockContext({ authData: getMockAuthData(delegateConsumer1.id) })
    );
    expectSinglePageListResult(agreements, [agreement5]);
  });

  describe("strictConsumer", () => {
    const tenantA = getMockTenant();
    const tenantB = getMockTenant();

    const eserviceA: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };

    const agreement11: Agreement = {
      ...getMockAgreement(),
      eserviceId: eserviceA.id,
      descriptorId: eserviceA.descriptors[0].id,
      producerId: eserviceA.producerId,
      consumerId: tenantA.id,
    };

    const agreement12: Agreement = {
      ...getMockAgreement(),
      eserviceId: eserviceA.id,
      descriptorId: eserviceA.descriptors[0].id,
      producerId: eserviceA.producerId,
      consumerId: tenantB.id,
    };

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegateId: tenantA.id,
      delegatorId: tenantB.id,
      eserviceId: eserviceA.id,
      state: delegationState.active,
    });

    beforeEach(async () => {
      await addOneTenant(tenantA);
      await addOneTenant(tenantB);
      await addOneEService(eserviceA);
      await addOneAgreement(agreement11);
      await addOneAgreement(agreement12);
      await addOneDelegation(consumerDelegation);
    });

    describe("the requester is tenantA", () => {
      it("should return agreements for which tenantA is the exact consumer (strictConsumer: true)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantA.id],
            strictConsumer: true,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantA.id) })
        );
        expectSinglePageListResult(agreements, [agreement11]);
      });

      it("should return agreements for which tenantA is the exact consumer or delegated consumer (strictConsumer: false)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantA.id],
            strictConsumer: false,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantA.id) })
        );
        expectSinglePageListResult(agreements, [agreement11, agreement12]);
      });

      it("should return agreements for which tenantB is the exact consumer (strictConsumer: true)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantB.id],
            strictConsumer: true,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantA.id) })
        );
        expectSinglePageListResult(agreements, [agreement12]);
      });

      it("should return agreements for which tenantB is the exact consumer or delegated consumer (strictConsumer: false)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantB.id],
            strictConsumer: false,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantA.id) })
        );
        expectSinglePageListResult(agreements, [agreement12]);
      });
    });

    describe("the requester is tenantB", () => {
      it("should return agreements for which tenantA is the exact consumer (strictConsumer: true)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantA.id],
            strictConsumer: true,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantB.id) })
        );
        expectSinglePageListResult(agreements, []);
      });

      it("should return agreements for which tenantA is the exact consumer or delegated consumer (strictConsumer: false)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantA.id],
            strictConsumer: false,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantB.id) })
        );
        expectSinglePageListResult(agreements, [agreement12]);
      });

      it("should return agreements for which tenantB is the exact consumer (strictConsumer: true)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantB.id],
            strictConsumer: true,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantB.id) })
        );
        expectSinglePageListResult(agreements, [agreement12]);
      });

      it("should return agreements for which tenantB is the exact consumer or delegated consumer (strictConsumer: false)", async () => {
        const agreements = await agreementService.getAgreements(
          {
            consumerId: [tenantB.id],
            strictConsumer: false,
          },
          10,
          0,
          getMockContext({ authData: getMockAuthData(tenantB.id) })
        );
        expectSinglePageListResult(agreements, [agreement12]);
      });
    });
  });
});
