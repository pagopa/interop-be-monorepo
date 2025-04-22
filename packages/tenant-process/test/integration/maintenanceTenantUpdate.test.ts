/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceTenantUpdatedV2,
  Tenant,
  protobufDecoder,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import {
  getMockContextMaintenance,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";
import { getMockMaintenanceTenantUpdate } from "../mockUtils.js";

describe("maintenanceTenantUpdate", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the update of a tenant", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    const tenantUpdate = getMockMaintenanceTenantUpdate();
    await tenantService.maintenanceTenantUpdate(
      {
        tenantId: mockTenant.id,
        tenantUpdate,
        version: 0,
      },
      getMockContextMaintenance({})
    );
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "MaintenanceTenantUpdated",
      event_version: 2,
    });
    const writtenPayload: MaintenanceTenantUpdatedV2 | undefined =
      protobufDecoder(MaintenanceTenantUpdatedV2).parse(writtenEvent.data);

    const updatedMockTenant: Tenant = {
      ...mockTenant,
      ...tenantUpdate,
      mails: tenantUpdate.mails.map((mail) => ({
        ...mail,
        createdAt: new Date(mail.createdAt),
      })),
      onboardedAt: new Date(tenantUpdate.onboardedAt),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedMockTenant));
  });
  it("Should throw tenantNotFound when the tenant doesn't exists", async () => {
    const mockTenant = getMockTenant();
    const tenantUpdate = getMockMaintenanceTenantUpdate();

    expect(
      tenantService.maintenanceTenantUpdate(
        {
          tenantId: mockTenant.id,
          tenantUpdate,
          version: 0,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
});
