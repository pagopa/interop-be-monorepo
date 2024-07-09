/* eslint-disable @typescript-eslint/no-floating-promises */

import { describe, expect, it } from "vitest";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  addOneEService,
  addOneTenant,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  readModelService,
} from "./utils.js";
describe("getProducers", () => {
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

  const eService1: EService = {
    ...getMockEService(),
    id: generateId(),
    name: "A",
    descriptors: [descriptor1],
    producerId: tenant1.id,
  };

  const descriptor2: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const eService2: EService = {
    ...getMockEService(),
    id: generateId(),
    name: "A",
    descriptors: [descriptor2],
    producerId: tenant2.id,
  };

  const descriptor3: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const eService3: EService = {
    ...getMockEService(),
    id: generateId(),
    name: "A",
    descriptors: [descriptor3],
    producerId: tenant3.id,
  };
  it("should get producers", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);

    const producers = await readModelService.getProducers({
      producerName: undefined,
      offset: 0,
      limit: 50,
    });
    expect(producers.totalCount).toBe(3);
    expect(producers.results).toEqual([tenant1, tenant2, tenant3]);
  });
  it("should get producers by name", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);

    const producers = await readModelService.getProducers({
      producerName: tenant1.name,
      offset: 0,
      limit: 50,
    });
    expect(producers.totalCount).toBe(1);
    expect(producers.results).toEqual([tenant1]);
  });
  it("should not get any tenants if no one matches the requested name", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);

    const producers = await readModelService.getProducers({
      producerName: "A tenant6",
      offset: 0,
      limit: 50,
    });
    expect(producers.totalCount).toBe(0);
    expect(producers.results).toEqual([]);
  });
  it("should not get any tenants if no one is in DB", async () => {
    await addOneEService(eService1);
    await addOneEService(eService2);

    const producers = await readModelService.getProducers({
      producerName: "A tenant",
      offset: 0,
      limit: 50,
    });
    expect(producers.totalCount).toBe(0);
    expect(producers.results).toEqual([]);
  });
  it("Should get producers (pagination: limit)", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);
    const tenantsByName = await readModelService.getProducers({
      producerName: undefined,
      offset: 0,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(3);
  });
  it("Should get producers (pagination: offset, limit)", async () => {
    await addOneTenant(tenant1);
    await addOneEService(eService1);
    await addOneTenant(tenant2);
    await addOneEService(eService2);
    await addOneTenant(tenant3);
    await addOneEService(eService3);
    const tenantsByName = await readModelService.getProducers({
      producerName: undefined,
      offset: 2,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(1);
  });
});
