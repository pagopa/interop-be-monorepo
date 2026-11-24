/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContextMaintenance,
  getMockTenant,
  getMockTenantMail,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  MaintenanceTenantDeletedV3,
  Tenant,
  protobufDecoder,
  toTenantV3,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import { tenantNotFound } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  contactDataManagerService,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

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
      event_version: 3,
    });
    const writtenPayload: MaintenanceTenantDeletedV3 | undefined =
      protobufDecoder(MaintenanceTenantDeletedV3).parse(writtenEvent.data);

    expect(writtenPayload).toEqual({
      tenantId: mockTenant.id,
      tenant: toTenantV3(mockTenant),
    });
  });
  it("should drop the legacy mails of a deleted tenant without creating a contact", async () => {
    const legacyTenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(legacyTenant);

    await tenantService.maintenanceTenantDelete(
      { tenantId: legacyTenant.id, version: 0 },
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEventByStreamId(
      legacyTenant.id,
      "tenant",
      postgresDB
    );
    expect(writtenEvent).toMatchObject({
      version: "1",
      type: "MaintenanceTenantDeleted",
      event_version: 3,
    });
    expect(
      protobufDecoder(MaintenanceTenantDeletedV3).parse(writtenEvent.data)
    ).toEqual({
      tenantId: legacyTenant.id,
      tenant: toTenantV3({ ...legacyTenant, mails: [] }),
    });
    expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
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
