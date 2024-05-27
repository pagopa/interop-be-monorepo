/* eslint-disable functional/no-let */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockTenant,
  getMockEService,
  getMockAgreement,
} from "pagopa-interop-commons-test/index.js";
import {
  EService,
  Tenant,
  generateId,
  EServiceId,
  agreementState,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { CompactEService } from "../src/model/domain/models.js";
import {
  addOneTenant,
  addOneEService,
  addOneAgreement,
  agreementService,
} from "./utils.js";

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
