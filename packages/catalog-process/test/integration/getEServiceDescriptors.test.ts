/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { eServiceNotFound } from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneTenant,
  catalogService,
} from "../integrationUtils.js";

describe("getEServiceDescriptors", () => {
  const producer: Tenant = { ...getMockTenant() };

  const publishedDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    createdAt: new Date("2024-01-01T00:00:00Z"),
  };
  const draftDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.draft),
    createdAt: new Date("2024-01-02T00:00:00Z"),
  };

  const eservice: EService = {
    ...getMockEService(),
    producerId: producer.id,
    descriptors: [publishedDescriptor, draftDescriptor],
  };

  const setup = async (): Promise<void> => {
    await addOneTenant(producer);
    await addOneEService(eservice);
  };

  it("should return all descriptors (including draft) to the producer", async () => {
    await setup();

    const result = await catalogService.getEServiceDescriptors(
      eservice.id,
      { offset: 0, limit: 10 },
      getMockContext({ authData: getMockAuthData(producer.id) })
    );

    expect(result.totalCount).toBe(2);
    expect(new Set(result.results.map((d) => d.id))).toEqual(
      new Set([publishedDescriptor.id, draftDescriptor.id])
    );
  });

  it("should hide draft descriptors from a non-producer requester", async () => {
    await setup();
    const otherOrgId: TenantId = generateId();

    const result = await catalogService.getEServiceDescriptors(
      eservice.id,
      { offset: 0, limit: 10 },
      getMockContext({ authData: getMockAuthData(otherOrgId) })
    );

    expect(result.totalCount).toBe(1);
    expect(result.results.map((d) => d.id)).toEqual([publishedDescriptor.id]);
  });

  it("should return an empty page but keep the full totalCount when offset is beyond the last descriptor", async () => {
    await setup();

    const result = await catalogService.getEServiceDescriptors(
      eservice.id,
      { offset: 10, limit: 10 },
      getMockContext({ authData: getMockAuthData(producer.id) })
    );

    expect(result.results).toEqual([]);
    expect(result.totalCount).toBe(2);
  });

  it("should let the producer filter by a draft state", async () => {
    await setup();

    const result = await catalogService.getEServiceDescriptors(
      eservice.id,
      { state: descriptorState.draft, offset: 0, limit: 10 },
      getMockContext({ authData: getMockAuthData(producer.id) })
    );

    expect(result.totalCount).toBe(1);
    expect(result.results.map((d) => d.id)).toEqual([draftDescriptor.id]);
  });

  it("should return nothing when a non-producer filters by a non-visible (draft) state", async () => {
    await setup();
    const otherOrgId: TenantId = generateId();

    const result = await catalogService.getEServiceDescriptors(
      eservice.id,
      { state: descriptorState.draft, offset: 0, limit: 10 },
      getMockContext({ authData: getMockAuthData(otherOrgId) })
    );

    expect(result.totalCount).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("should show non-draft states like Archiving to a non-producer (not only activeDescriptorStates)", async () => {
    // Regression: a non-producer entitled to see active descriptors must also
    // see `archiving`/`archivingSuspended` — `isActiveDescriptor` only excludes
    // `draft` and `waitingForApproval`, not the narrower `activeDescriptorStates`.
    const archivingDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.archiving),
      createdAt: new Date("2024-01-03T00:00:00Z"),
    };
    const eserviceWithArchiving: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [publishedDescriptor, archivingDescriptor, draftDescriptor],
    };
    await addOneTenant(producer);
    await addOneEService(eserviceWithArchiving);
    const otherOrgId: TenantId = generateId();

    const result = await catalogService.getEServiceDescriptors(
      eserviceWithArchiving.id,
      { offset: 0, limit: 10 },
      getMockContext({ authData: getMockAuthData(otherOrgId) })
    );

    expect(result.totalCount).toBe(2);
    expect(new Set(result.results.map((d) => d.id))).toEqual(
      new Set([publishedDescriptor.id, archivingDescriptor.id])
    );
  });

  it("should throw eServiceNotFound when the e-service does not exist", async () => {
    await setup();
    const notExistingId = generateId<EService["id"]>();

    await expect(
      catalogService.getEServiceDescriptors(
        notExistingId,
        { offset: 0, limit: 10 },
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(eServiceNotFound(notExistingId));
  });
});
