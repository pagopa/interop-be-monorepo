import { describe, expect, it } from "vitest";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
} from "pagopa-interop-models";
import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "../integrationUtils.js";
import { getMockAgreement } from "../mockUtils.js";

describe("getConsumers", () => {
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
