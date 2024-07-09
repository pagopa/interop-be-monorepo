import { describe, expect, it } from "vitest";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  readModelService,
} from "./utils.js";

describe("getConsumers", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "A tenant1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "A tenant2",
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    id: generateId(),
    name: "A tenant3",
  };

  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const descriptor2: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const descriptor3: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const eService1: EService = {
    ...getMockEService(),
    name: "A",
    descriptors: [descriptor1],
  };

  const eService2: EService = {
    ...getMockEService(),
    name: "B",
    descriptors: [descriptor2],
    producerId: eService1.producerId,
  };

  const eService3: EService = {
    ...getMockEService(),
    name: "C",
    descriptors: [descriptor3],
    producerId: eService1.producerId,
  };

  const agreementEservice1 = getMockAgreement({
    eserviceId: eService1.id,
    descriptorId: descriptor1.id,
    producerId: eService1.producerId,
    consumerId: tenant1.id,
  });

  const agreementEservice2 = getMockAgreement({
    eserviceId: eService2.id,
    descriptorId: descriptor2.id,
    producerId: eService2.producerId,
    consumerId: tenant2.id,
  });

  const agreementEservice3 = getMockAgreement({
    eserviceId: eService3.id,
    descriptorId: descriptor3.id,
    producerId: eService3.producerId,
    consumerId: tenant3.id,
  });
  it("should get the tenants consuming any of the eservices of a specific producerId", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneAgreement(agreementEservice1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneAgreement(agreementEservice2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);
    await addOneAgreement(agreementEservice3);

    const consumers = await readModelService.getConsumers({
      consumerName: undefined,
      producerId: eService1.producerId,
      offset: 0,
      limit: 50,
    });
    expect(consumers.totalCount).toBe(3);
    expect(consumers.results).toEqual([tenant1, tenant2, tenant3]);
  });
  it("should get the tenants consuming any of the eservices of a specific name", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneAgreement(agreementEservice1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneAgreement(agreementEservice2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);
    await addOneAgreement(agreementEservice3);

    const consumers = await readModelService.getConsumers({
      consumerName: tenant1.name,
      producerId: eService1.producerId,
      offset: 0,
      limit: 50,
    });
    expect(consumers.totalCount).toBe(1);
    expect(consumers.results).toEqual([tenant1]);
  });
  it("should not get any tenants, if no one is consuming any of the eservices of a specific producerId", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);

    const consumers = await readModelService.getConsumers({
      consumerName: undefined,
      producerId: eService1.producerId,
      offset: 0,
      limit: 50,
    });
    expect(consumers.totalCount).toBe(0);
    expect(consumers.results).toEqual([]);
  });
  it("should not get any tenants, if no one is consuming any of the eservices of a specific name", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);

    const consumers = await readModelService.getConsumers({
      consumerName: "A tenant4",
      producerId: eService1.producerId,
      offset: 0,
      limit: 50,
    });
    expect(consumers.totalCount).toBe(0);
    expect(consumers.results).toEqual([]);
  });
  it("Should get consumers (pagination: limit)", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneAgreement(agreementEservice1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);

    const agreementEservice2 = getMockAgreement({
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      producerId: eService2.producerId,
      consumerId: tenant2.id,
    });
    await addOneAgreement(agreementEservice2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);

    const agreementEservice3 = getMockAgreement({
      eserviceId: eService3.id,
      descriptorId: descriptor3.id,
      producerId: eService3.producerId,
      consumerId: tenant3.id,
    });
    await addOneAgreement(agreementEservice3);

    const tenantsByName = await readModelService.getConsumers({
      consumerName: undefined,
      producerId: eService1.producerId,
      offset: 0,
      limit: 2,
    });
    expect(tenantsByName.results.length).toBe(2);
  });
  it("Should get consumers (pagination: offset, limit)", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);

    const agreementEservice1 = getMockAgreement({
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      producerId: eService1.producerId,
      consumerId: tenant1.id,
    });
    await addOneAgreement(agreementEservice1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);

    const agreementEservice2 = getMockAgreement({
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      producerId: eService2.producerId,
      consumerId: tenant2.id,
    });
    await addOneAgreement(agreementEservice2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);

    const agreementEservice3 = getMockAgreement({
      eserviceId: eService3.id,
      descriptorId: descriptor3.id,
      producerId: eService3.producerId,
      consumerId: tenant3.id,
    });
    await addOneAgreement(agreementEservice3);

    const tenantsByName = await readModelService.getConsumers({
      consumerName: undefined,
      producerId: eService1.producerId,
      offset: 2,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(1);
  });
});
