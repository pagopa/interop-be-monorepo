/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  MaintenanceTenantDeletedV2,
  generateId,
  protobufDecoder,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { tenantNotFound } from "../src/model/domain/errors.js";
import { addOneTenant, getMockTenant, readLastTenantEvent } from "./utils.js";
import {
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testMaintenanceTenantDelete = (): ReturnType<typeof describe> =>
  describe("maintenanceTenantDelete", async () => {
    it("should write on event-store for the deletion of a tenant", async () => {
      const mockTenant = getMockTenant();
      await addOneTenant(mockTenant, postgresDB, tenants);
      await tenantService.maintenanceTenantDeleted(mockTenant.id, generateId());
      const writtenEvent = await readLastTenantEvent(mockTenant.id, postgresDB);
      if (!writtenEvent) {
        fail("Creation failed: tenant not found in event-store");
      }
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
        tenantService.maintenanceTenantDeleted(mockTenant.id, generateId())
      ).rejects.toThrowError(tenantNotFound(mockTenant.id));
    });
  });
