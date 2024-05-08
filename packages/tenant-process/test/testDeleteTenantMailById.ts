/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  operationForbidden,
  TenantMailDeletedV2,
} from "pagopa-interop-models";
import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import { mailNotFound, tenantNotFound } from "../src/model/domain/errors.js";
import {
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";
import { addOneTenant, getMockTenant, readLastTenantEvent } from "./utils.js";

export const testDeleteTenantMailById = (): ReturnType<typeof describe> =>
  describe("deleteTenantMailById", async () => {
    let tenant: Tenant;
    const mailId = generateId();
    const notDeletedMailId = generateId();

    beforeAll(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      tenant = {
        ...getMockTenant(),
        mails: [
          {
            id: mailId,
            createdAt: new Date(),
            kind: "CONTACT_EMAIL",
            address: "testMail@test.it",
          },
          {
            id: notDeletedMailId,
            createdAt: new Date(),
            kind: "CONTACT_EMAIL",
            address: "testMail2@test.it",
          },
        ],
      };
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("Should delete the mail with the required mailId if it exist ", async () => {
      await addOneTenant(tenant, postgresDB, tenants);
      await tenantService.deleteTenantMailById(
        tenant.id,
        mailId,
        tenant.id,
        generateId()
      );
      const writtenEvent = await readLastTenantEvent(tenant.id, postgresDB);

      expect(writtenEvent).toMatchObject({
        stream_id: tenant.id,
        version: "1",
        type: "TenantMailDeleted",
        event_version: 2,
      });

      const writtenPayload: TenantMailDeletedV2 | undefined = protobufDecoder(
        TenantMailDeletedV2
      ).parse(writtenEvent.data);

      const updatedTenant: Tenant = {
        ...tenant,
        mails: [
          {
            id: notDeletedMailId,
            createdAt: new Date(),
            kind: "CONTACT_EMAIL",
            address: "testMail2@test.it",
          },
        ],
        updatedAt: new Date(),
      };
      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    });
    it("Should throw tenantNotFound if the tenant doesn't exists", async () => {
      expect(
        tenantService.deleteTenantMailById(
          tenant.id,
          mailId,
          tenant.id,
          generateId()
        )
      ).rejects.toThrowError(tenantNotFound(tenant.id));
    });
    it("Should throw operationForbidden when tenantId is not the organizationId", async () => {
      await addOneTenant(tenant, postgresDB, tenants);
      expect(
        tenantService.deleteTenantMailById(
          tenant.id,
          mailId,
          generateId(),
          generateId()
        )
      ).rejects.toThrowError(operationForbidden);
    });
    it("Should throw mailId not found if it doesn't exists in the tenant mail", async () => {
      await addOneTenant(tenant, postgresDB, tenants);
      const mailIdNotInTenant = generateId();
      expect(
        tenantService.deleteTenantMailById(
          tenant.id,
          mailIdNotInTenant,
          tenant.id,
          generateId()
        )
      ).rejects.toThrowError(mailNotFound(mailIdNotInTenant));
    });
  });
