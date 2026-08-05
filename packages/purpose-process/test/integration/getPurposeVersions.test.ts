/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  getMockAuthData,
  getMockContext,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Purpose,
  PurposeVersion,
  generateId,
  PurposeId,
  EService,
  purposeVersionState,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  purposeNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  purposeService,
  addOneEService,
  addOneTenant,
} from "../integrationUtils.js";

describe("getPurposeVersions", () => {
  const consumer = { ...getMockTenant(), kind: tenantKind.PA };
  const mockEService: EService = { ...getMockEService() };

  // Versions with deterministic createdAt so ordering (createdAt asc) is predictable.
  const version1: PurposeVersion = {
    ...getMockPurposeVersion(),
    id: generateId(),
    state: purposeVersionState.draft,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  };
  const version2: PurposeVersion = {
    ...getMockPurposeVersion(),
    id: generateId(),
    state: purposeVersionState.active,
    createdAt: new Date("2024-01-02T00:00:00Z"),
  };
  const version3: PurposeVersion = {
    ...getMockPurposeVersion(),
    id: generateId(),
    state: purposeVersionState.active,
    createdAt: new Date("2024-01-03T00:00:00Z"),
  };
  const version4: PurposeVersion = {
    ...getMockPurposeVersion(),
    id: generateId(),
    state: purposeVersionState.suspended,
    createdAt: new Date("2024-01-04T00:00:00Z"),
  };
  const version5: PurposeVersion = {
    ...getMockPurposeVersion(),
    id: generateId(),
    state: purposeVersionState.archived,
    createdAt: new Date("2024-01-05T00:00:00Z"),
  };

  const mockPurpose: Purpose = {
    ...getMockPurpose(),
    eserviceId: mockEService.id,
    consumerId: consumer.id,
    versions: [version1, version2, version3, version4, version5],
  };

  const setup = async (): Promise<void> => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneTenant(consumer);
  };

  const getVersions = (
    offset: number,
    limit: number,
    state?: PurposeVersion["state"]
  ) =>
    purposeService.getPurposeVersions(
      mockPurpose.id,
      { offset, limit, state },
      getMockContext({ authData: getMockAuthData(consumer.id) })
    );

  it("should return all versions ordered by createdAt asc", async () => {
    await setup();

    const result = await getVersions(0, 10);

    expect(result.totalCount).toBe(5);
    expect(result.results.map((v) => v.id)).toEqual([
      version1.id,
      version2.id,
      version3.id,
      version4.id,
      version5.id,
    ]);
  });

  it("should paginate with offset and limit while keeping the full totalCount", async () => {
    await setup();

    const page1 = await getVersions(0, 2);
    expect(page1.totalCount).toBe(5);
    expect(page1.results.map((v) => v.id)).toEqual([version1.id, version2.id]);

    const page2 = await getVersions(2, 2);
    expect(page2.totalCount).toBe(5);
    expect(page2.results.map((v) => v.id)).toEqual([version3.id, version4.id]);

    const page3 = await getVersions(4, 2);
    expect(page3.totalCount).toBe(5);
    expect(page3.results.map((v) => v.id)).toEqual([version5.id]);
  });

  it("should return an empty page but keep the full totalCount when offset is beyond the last version", async () => {
    await setup();

    const result = await getVersions(10, 2);
    expect(result.results).toEqual([]);
    expect(result.totalCount).toBe(5);
  });

  it("should filter by state and compute totalCount over the filtered set", async () => {
    await setup();

    const activeVersions = await getVersions(0, 10, purposeVersionState.active);
    expect(activeVersions.totalCount).toBe(2);
    expect(activeVersions.results.map((v) => v.id)).toEqual([
      version2.id,
      version3.id,
    ]);

    const suspendedVersions = await getVersions(
      0,
      10,
      purposeVersionState.suspended
    );
    expect(suspendedVersions.totalCount).toBe(1);
    expect(suspendedVersions.results.map((v) => v.id)).toEqual([version4.id]);
  });

  it("should apply pagination on top of the state filter", async () => {
    await setup();

    const result = await getVersions(0, 1, purposeVersionState.active);
    expect(result.totalCount).toBe(2);
    expect(result.results.map((v) => v.id)).toEqual([version2.id]);
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    await setup();
    const notExistingId: PurposeId = generateId();

    await expect(
      purposeService.getPurposeVersions(
        notExistingId,
        { offset: 0, limit: 10, state: undefined },
        getMockContext({ authData: getMockAuthData(consumer.id) })
      )
    ).rejects.toThrowError(purposeNotFound(notExistingId));
  });

  it("should throw tenantNotAllowed if the requester is not producer/consumer/delegate", async () => {
    await setup();
    const otherTenant = { ...getMockTenant(), kind: tenantKind.PA };
    await addOneTenant(otherTenant);

    await expect(
      purposeService.getPurposeVersions(
        mockPurpose.id,
        { offset: 0, limit: 10, state: undefined },
        getMockContext({ authData: getMockAuthData(otherTenant.id) })
      )
    ).rejects.toThrowError(tenantNotAllowed(otherTenant.id));
  });
});
