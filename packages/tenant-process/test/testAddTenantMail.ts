/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  operationForbidden,
  TenantMailAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
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
    const mockTenant = getMockTenant();
    let mailSeed: MailSeed;

    beforeAll(async () => {
      mailSeed = {
        kind: "CONTACT_EMAIL",
        address: "testMail@test.it",
        description: "mail description",
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("Should correctly add the mail", async () => {
      await addOneTenant(mockTenant, postgresDB, tenants);
      await tenantService.addTenantMail(
        {
          tenantId: mockTenant.id,
          mailSeed,
          organizationId: mockTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      );
      const writtenEvent = await readLastTenantEvent(mockTenant.id, postgresDB);

      expect(writtenEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "1",
        type: "TenantMailAdded",
        event_version: 2,
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
    });
    it("Should throw tenantNotFound if the tenant doesn't exists", async () => {
      expect(
        tenantService.addTenantMail(
          {
            tenantId: mockTenant.id,
            mailSeed,
            organizationId: mockTenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(tenantNotFound(mockTenant.id));
    });
    it("Should throw operationForbidden when tenantId is not the organizationId", async () => {
      await addOneTenant(mockTenant, postgresDB, tenants);
      expect(
        tenantService.addTenantMail(
          {
            tenantId: mockTenant.id,
            mailSeed,
            organizationId: generateId(),
            correlationId: generateId(),
          },
          genericLogger
        )
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
        tenantService.addTenantMail(
          {
            tenantId: tenant.id,
            mailSeed,
            organizationId: tenant.id,
            correlationId: generateId(),
          },
          genericLogger
        )
      ).rejects.toThrowError(mailAlreadyExists(mailSeed.address));
    });
  });
