import {
  generateId,
  MaintenanceTenantRemoteIdDeletedV2,
  protobufDecoder,
  TenantEvent,
  Tenant,
  TenantId,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import {
  getMockContextMaintenance,
  getMockTenant,
  ReadEvent,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("maintenanceTenantDeleteRemoteId", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const deletedRemoteId = {
    origin: "ISTAT",
    value: "12345",
    assignmentTimestamp: new Date(),
  };
  const notDeletedRemoteId = {
    origin: "OTHER",
    value: "67890",
    assignmentTimestamp: new Date(),
  };

  it("should write an event with the remote id removed", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      remoteIds: [deletedRemoteId, notDeletedRemoteId],
    };

    await addOneTenant(tenant);
    await tenantService.maintenanceTenantDeleteRemoteId(
      {
        tenantId: tenant.id,
        origin: deletedRemoteId.origin,
      },
      getMockContextMaintenance({})
    );
    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "MaintenanceTenantRemoteIdDeleted",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      MaintenanceTenantRemoteIdDeletedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...tenant,
      remoteIds: [notDeletedRemoteId],
      updatedAt: new Date(),
    };
    expect(writtenPayload).toEqual({
      tenant: toTenantV2(updatedTenant),
    });
  });

  it("should throw tenantNotFound when the tenant does not exist", async () => {
    const tenantId = generateId<TenantId>();
    await expect(
      tenantService.maintenanceTenantDeleteRemoteId(
        {
          tenantId,
          origin: deletedRemoteId.origin,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantNotFound(tenantId));
  });

  it("should not write an event when the remote id does not exist", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      remoteIds: [notDeletedRemoteId],
    };

    await addOneTenant(tenant);
    await tenantService.maintenanceTenantDeleteRemoteId(
      {
        tenantId: tenant.id,
        origin: deletedRemoteId.origin,
      },
      getMockContextMaintenance({})
    );

    const writtenEvent: ReadEvent<TenantEvent> = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "0",
      type: "TenantOnboarded",
      event_version: 2,
    });
  });

  it("should not write an event when the tenant has no remote ids", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      remoteIds: undefined,
    };

    await addOneTenant(tenant);
    await tenantService.maintenanceTenantDeleteRemoteId(
      {
        tenantId: tenant.id,
        origin: deletedRemoteId.origin,
      },
      getMockContextMaintenance({})
    );

    const writtenEvent: ReadEvent<TenantEvent> = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "0",
      type: "TenantOnboarded",
      event_version: 2,
    });
  });
});
