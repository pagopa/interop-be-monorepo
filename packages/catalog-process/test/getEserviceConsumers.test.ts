import { genericLogger } from "pagopa-interop-commons";
import { Descriptor, descriptorState, EService } from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  catalogService,
  getMockAgreement,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "./utils.js";

describe("get eservice consumers", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should get the consumers of the given eservice", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice1: EService = {
      ...mockEService,
      descriptors: [descriptor1],
    };
    await addOneEService(eservice1);
    const tenant = getMockTenant();
    await addOneTenant(tenant);
    const agreement = getMockAgreement({
      eserviceId: eservice1.id,
      descriptorId: descriptor1.id,
      producerId: eservice1.producerId,
      consumerId: tenant.id,
    });
    await addOneAgreement(agreement);

    const result = await catalogService.getEServiceConsumers(
      eservice1.id,
      0,
      50,
      genericLogger
    );
    expect(result.totalCount).toBe(1);
    expect(result.results[0].consumerName).toBe(tenant.name);
  });

  it("should not get any consumers, if no one is using the given eservice", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice1: EService = {
      ...mockEService,
      descriptors: [descriptor1],
    };
    await addOneEService(eservice1);

    const consumers = await catalogService.getEServiceConsumers(
      eservice1.id,
      0,
      50,
      genericLogger
    );
    expect(consumers.results).toStrictEqual([]);
    expect(consumers.totalCount).toBe(0);
  });
});
