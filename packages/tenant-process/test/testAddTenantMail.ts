/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  operationForbidden,
  TenantMailAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  mailAlreadyExists,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { MailSeed } from "../src/model/domain/models.js";
import {
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";
import { addOneTenant, getMockTenant, readLastTenantEvent } from "./utils.js";

export const testAddTenantMail = (): ReturnType<typeof describe> =>
  describe("addTenantMail", async () => {
    const mailSeed: MailSeed = {
      kind: "CONTACT_EMAIL",
      address: "testMail@test.it",
      description: "mail description",
    };

    it("Should correctly add the mail", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const mockTenant = getMockTenant();
      await addOneTenant(mockTenant, postgresDB, tenants);
      await tenantService.addTenantMail({
        tenantId: mockTenant.id,
        mailSeed,
        organizationId: mockTenant.id,
        correlationId: generateId(),
      });
      const writtenEvent = await readLastTenantEvent(mockTenant.id, postgresDB);
      if (!writtenEvent) {
        fail("Creation fails: tenant not found in event-store");
      }

      expect(writtenEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "1",
        type: "TenantMailAdded",
      });

      const writtenPayload: TenantMailAddedV2 | undefined = protobufDecoder(
        TenantMailAddedV2
      ).parse(writtenEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        mails: [
          {
            ...mailSeed,
            id: writtenPayload.mailId,
            createdAt: new Date(),
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound if the tenant doesn't exists", async () => {
      const mockTenant = getMockTenant();

      expect(
        tenantService.addTenantMail({
          tenantId: mockTenant.id,
          mailSeed,
          organizationId: mockTenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantNotFound(mockTenant.id));
    });
    it("Should throw operationForbidden when tenantId is not the organizationId", async () => {
      const mockTenant = getMockTenant();

      await addOneTenant(mockTenant, postgresDB, tenants);
      expect(
        tenantService.addTenantMail({
          tenantId: mockTenant.id,
          mailSeed,
          organizationId: generateId(),
          correlationId: generateId(),
        })
      ).rejects.toThrowError(operationForbidden);
    });
    it("Should throw mailAlreadyExists if address already exists in the tenant mail", async () => {
      const tenant: Tenant = {
        ...getMockTenant(),
        mails: [
          {
            ...mailSeed,
            id: generateId(),
            createdAt: new Date(),
          },
        ],
      };

      await addOneTenant(tenant, postgresDB, tenants);
      expect(
        tenantService.addTenantMail({
          tenantId: tenant.id,
          mailSeed,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(mailAlreadyExists(mailSeed.address));
    });
  });
