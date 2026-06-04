import {
  generateId,
  MaintenanceTenantRemoteIdDeletedV2,
  protobufDecoder,
  Tenant,
  TenantId,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import {
  getMockContextMaintenance,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  remoteIdNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("maintenanceDeleteRemoteId", async () => {
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
    await tenantService.maintenanceDeleteRemoteId(
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
      tenantService.maintenanceDeleteRemoteId(
        {
          tenantId,
          origin: deletedRemoteId.origin,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantNotFound(tenantId));
  });

  it("should throw remoteIdNotFound when the remote id does not exist", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      remoteIds: [notDeletedRemoteId],
    };

    await addOneTenant(tenant);
    await expect(
      tenantService.maintenanceDeleteRemoteId(
        {
          tenantId: tenant.id,
          origin: deletedRemoteId.origin,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(remoteIdNotFound(deletedRemoteId.origin));
  });

  it("should throw remoteIdNotFound when the tenant has no remote ids", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      remoteIds: undefined,
    };

    await addOneTenant(tenant);
    await expect(
      tenantService.maintenanceDeleteRemoteId(
        {
          tenantId: tenant.id,
          origin: deletedRemoteId.origin,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(remoteIdNotFound(deletedRemoteId.origin));
  });
});
