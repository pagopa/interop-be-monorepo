/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceTenantDeletedV2,
  protobufDecoder,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  getMockContextMaintenance,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import { addOneTenant, postgresDB, tenantService } from "../integrationUtils.js";

describe("maintenanceTenantDelete", async () => {
  it("should write on event-store for the deletion of a tenant", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    await tenantService.maintenanceTenantDelete(
      {
        tenantId: mockTenant.id,
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
      type: "MaintenanceTenantDeleted",
      event_version: 2,
    });
    const writtenPayload: MaintenanceTenantDeletedV2 | undefined =
      protobufDecoder(MaintenanceTenantDeletedV2).parse(writtenEvent.data);

    expect(writtenPayload.tenant).toEqual(toTenantV2(mockTenant));
  });
  it("Should throw tenantNotFound when the tenant doesn't exists", async () => {
    const mockTenant = getMockTenant();

    expect(
      tenantService.maintenanceTenantDelete(
        {
          tenantId: mockTenant.id,
          version: 0,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
});
