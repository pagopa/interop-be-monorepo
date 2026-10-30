import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
  agreementState,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelDB,
  readModelService,
} from "../integrationUtils.js";
import { getMockAgreement } from "../mockUtils.js";

describe("getConsumers", () => {
  it.each(["Unit", "Area", "Institution", "absent"])(
    "uses joined ancestry for filter %s without an extra query",
    async (consumerName) => {
      const producer = getMockTenant();
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
      for (const tenant of [producer, root, parent, unit]) {
        await addOneTenant(tenant);
      }
      for (const state of [agreementState.active, agreementState.suspended]) {
        await addOneAgreement({
          ...getMockAgreement({
            eserviceId: getMockEService().id,
            descriptorId: getMockDescriptor().id,
            producerId: producer.id,
            consumerId: unit.id,
          }),
          state,
        });
      }
      const select = vi.spyOn(readModelDB, "select");
      try {
        const result = await readModelService.getConsumers({
          producerId: producer.id,
          consumerName,
          offset: 0,
          limit: 1,
        });
        expect(result.totalCount).toBe(consumerName === "absent" ? 0 : 1);
        expect(result.results).toEqual(
          consumerName === "absent"
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

  const producer = getMockTenant();
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
  it("should get the tenants consuming any of the eservices of a specific producerId", async () => {
    await addOneTenant(producer);
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const descriptor1a: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
      producerId: producer.id,
    };
    await addOneEService(eService1);

    const eService1a: EService = {
      ...getMockEService(),
      name: "1A",
      descriptors: [descriptor1a],
      producerId: producer.id,
    };
    await addOneEService(eService1);

    const agreementEservice1 = getMockAgreement({
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      producerId: eService1.producerId,
      consumerId: tenant1.id,
    });
    await addOneAgreement(agreementEservice1);

    const agreementEservice1a = getMockAgreement({
      eserviceId: eService1a.id,
      descriptorId: descriptor1a.id,
      producerId: eService1a.producerId,
      consumerId: tenant1.id,
    });
    await addOneAgreement(agreementEservice1a);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: producer.id,
    };
    await addOneEService(eService2);

    const agreementEservice2 = getMockAgreement({
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      producerId: producer.id,
      consumerId: tenant2.id,
    });
    await addOneAgreement(agreementEservice2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "C",
      descriptors: [descriptor3],
      producerId: producer.id,
    };
    await addOneEService(eService3);

    const agreementEservice3 = getMockAgreement({
      eserviceId: eService3.id,
      descriptorId: descriptor3.id,
      producerId: producer.id,
      consumerId: tenant3.id,
    });
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
  it("should get the tenants by name, consuming any of the eservices of a specific producer", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
    };
    await addOneEService(eService1);

    const agreementEservice1 = getMockAgreement({
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      producerId: eService1.producerId,
      consumerId: tenant1.id,
    });
    await addOneAgreement(agreementEservice1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: eService1.producerId,
    };
    await addOneEService(eService2);

    const agreementEservice2 = getMockAgreement({
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      producerId: eService2.producerId,
      consumerId: tenant2.id,
    });
    await addOneAgreement(agreementEservice2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "C",
      descriptors: [descriptor3],
      producerId: eService1.producerId,
    };
    await addOneEService(eService3);

    const agreementEservice3 = getMockAgreement({
      eserviceId: eService3.id,
      descriptorId: descriptor3.id,
      producerId: eService3.producerId,
      consumerId: tenant3.id,
    });
    await addOneAgreement(agreementEservice3);

    const consumers = await readModelService.getConsumers({
      consumerName: "1",
      producerId: eService1.producerId,
      offset: 0,
      limit: 50,
    });
    expect(consumers.totalCount).toBe(1);
    expect(consumers.results).toEqual([tenant1]);
  });
  it("should not get any tenants, if no one is consuming any of the eservices of a specific producerId", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
    };
    await addOneEService(eService1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: eService1.producerId,
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
      producerId: eService1.producerId,
    };
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

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
    };
    await addOneEService(eService1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: eService1.producerId,
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
      producerId: eService1.producerId,
    };
    await addOneEService(eService3);

    const consumers = await readModelService.getConsumers({
      consumerName: "Tenant 4",
      producerId: eService1.producerId,
      offset: 0,
      limit: 50,
    });
    expect(consumers.totalCount).toBe(0);
    expect(consumers.results).toEqual([]);
  });
  it("should get consumers (pagination: limit)", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
    };
    await addOneEService(eService1);

    const agreementEservice1 = getMockAgreement({
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      producerId: eService1.producerId,
      consumerId: tenant1.id,
    });
    await addOneAgreement(agreementEservice1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: eService1.producerId,
    };
    await addOneEService(eService2);

    const agreementEservice2 = getMockAgreement({
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      producerId: eService2.producerId,
      consumerId: tenant2.id,
    });
    await addOneAgreement(agreementEservice2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "C",
      descriptors: [descriptor3],
      producerId: eService1.producerId,
    };
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
  it("should get consumers (pagination: offset, limit)", async () => {
    await addOneTenant(tenant1);

    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService1: EService = {
      ...getMockEService(),
      name: "A",
      descriptors: [descriptor1],
    };
    await addOneEService(eService1);

    const agreementEservice1 = getMockAgreement({
      eserviceId: eService1.id,
      descriptorId: descriptor1.id,
      producerId: eService1.producerId,
      consumerId: tenant1.id,
    });
    await addOneAgreement(agreementEservice1);

    await addOneTenant(tenant2);

    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService2: EService = {
      ...getMockEService(),
      name: "B",
      descriptors: [descriptor2],
      producerId: eService1.producerId,
    };
    await addOneEService(eService2);

    const agreementEservice2 = getMockAgreement({
      eserviceId: eService2.id,
      descriptorId: descriptor2.id,
      producerId: eService2.producerId,
      consumerId: tenant2.id,
    });
    await addOneAgreement(agreementEservice2);

    await addOneTenant(tenant3);

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };

    const eService3: EService = {
      ...getMockEService(),
      name: "C",
      descriptors: [descriptor3],
      producerId: eService1.producerId,
    };
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
