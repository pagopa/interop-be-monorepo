import {
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import {
  addOneEService,
  addOneTenant,
  readModelDB,
  readModelService,
} from "../integrationUtils.js";

describe("getProducers", () => {
  it.each(["Unit", "Area", "Institution", "absent"])(
    "uses joined ancestry for filter %s without an extra query",
    async (producerName) => {
      const root: Tenant = { ...getMockTenant(), name: "Institution" };
      const parent: Tenant = {
        ...getMockTenant(),
        name: "Area",
        subUnitType: "AOO",
      };
      const unit: Tenant = {
        ...getMockTenant(),
        name: "Unit",
        subUnitType: "UO",
        parentTenantId: parent.id,
        rootTenantId: root.id,
      };
      for (const tenant of [root, parent, unit]) {
        await addOneTenant(tenant);
      }
      for (let i = 0; i < 2; i++) {
        await addOneEService({ ...getMockEService(), producerId: unit.id });
      }
      const select = vi.spyOn(readModelDB, "select");
      try {
        const result = await readModelService.getProducers({
          producerName,
          offset: 0,
          limit: 1,
        });
        expect(result.totalCount).toBe(producerName === "absent" ? 0 : 1);
        expect(result.results).toEqual(
          producerName === "absent"
            ? []
            : [
                {
                  ...unit,
                  parentTenant: {
                    id: parent.id,
                    name: parent.name,
                    subUnitType: parent.subUnitType,
                    parentTenant: { id: root.id, name: root.name },
                  },
                },
              ]
        );
        expect(select).not.toHaveBeenCalled();
      } finally {
        select.mockRestore();
      }
    }
  );

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
      producerName: "1",
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
