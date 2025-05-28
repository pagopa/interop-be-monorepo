import { describe, expect, it } from "vitest";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
} from "pagopa-interop-models";
import {
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  addOneEService,
  addOneTenant,
  readModelService,
} from "../integrationUtils.js";

describe("getProducers", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    name: "Tenant 2",
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    name: "Tenant 3",
  };
  it("should get producers", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: tenant1.id,
    };
    await addOneEService(eService1);

    const eService1a: EService = {
      ...getMockEService(),
      name: "1A",
      descriptors: [],
      producerId: tenant1.id,
    };
    await addOneEService(eService1a);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: tenant2.id,
    };
    await addOneEService(eService2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "C",
      descriptors: [descriptor3],
      producerId: tenant3.id,
    };
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

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: tenant1.id,
    };
    await addOneEService(eService1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor2],
      producerId: tenant2.id,
    };
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

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: tenant1.id,
    };
    await addOneEService(eService1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor2],
      producerId: tenant2.id,
    };
    await addOneEService(eService2);

    const producers = await readModelService.getProducers({
      producerName: "Tenant 6",
      offset: 0,
      limit: 50,
    });
    expect(producers.totalCount).toBe(0);
    expect(producers.results).toEqual([]);
  });
  it("should not get any tenants if no one is in DB", async () => {
    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: tenant1.id,
    };
    await addOneEService(eService1);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor2],
      producerId: tenant2.id,
    };
    await addOneEService(eService2);

    const producers = await readModelService.getProducers({
      producerName: "A tenant",
      offset: 0,
      limit: 50,
    });
    expect(producers.totalCount).toBe(0);
    expect(producers.results).toEqual([]);
  });
  it("should get producers (pagination: limit)", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: tenant1.id,
    };
    await addOneEService(eService1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor2],
      producerId: tenant2.id,
    };
    await addOneEService(eService2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor3],
      producerId: tenant3.id,
    };
    await addOneEService(eService3);
    const tenantsByName = await readModelService.getProducers({
      producerName: undefined,
      offset: 0,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(3);
  });
  it("should get producers (pagination: offset, limit)", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: tenant1.id,
    };
    await addOneEService(eService1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor2],
      producerId: tenant2.id,
    };
    await addOneEService(eService2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor3],
      producerId: tenant3.id,
    };
    await addOneEService(eService3);
    const tenantsByName = await readModelService.getProducers({
      producerName: undefined,
      offset: 2,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(1);
  });
});
