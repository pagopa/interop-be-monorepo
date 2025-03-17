import { describe, it, expect, vi } from "vitest";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  SelfcareMappingCreatedV1,
  Tenant,
  TenantCreatedV1,
  TenantDeletedV1,
  TenantEventEnvelope,
  TenantMailAddedV1,
  TenantMailDeletedV1,
  TenantUpdatedV1,
  generateId,
} from "pagopa-interop-models";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { toTenantV1 } from "./converterV1.js";
import { readModelService } from "./utils.js";

describe("Integration tests", async () => {
  describe("Events V1", async () => {
    const mockTenant = getMockTenant();

    it("TenantCreated", async () => {
      const payload: TenantCreatedV1 = {
        tenant: toTenantV1(mockTenant),
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 1,
        type: "TenantCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, readModelService);

      const retrievedTenant = await readModelService.getTenantById(
        mockTenant.id
      );

      expect(retrievedTenant?.data).toEqual({
        ...mockTenant,
        onboardedAt: mockTenant.createdAt,
      });
      expect(retrievedTenant?.metadata).toEqual({ version: 1 });
    });

    it("TenantDeleted", async () => {
      await readModelService.upsertTenant(mockTenant, 1);

      const payload: TenantDeletedV1 = {
        tenantId: mockTenant.id,
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 1,
        type: "TenantDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, readModelService);

      const retrievedTenant = await readModelService.getTenantById(
        mockTenant.id
      );
      expect(retrievedTenant?.data).toBeUndefined();
    });

    it("TenantUpdated", async () => {
      await readModelService.upsertTenant(mockTenant, 1);

      const updatedTenant: Tenant = {
        ...mockTenant,
        name: "updated name",
      };
      const payload: TenantUpdatedV1 = {
        tenant: toTenantV1(updatedTenant),
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "TenantUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, readModelService);

      const retrievedTenant = await readModelService.getTenantById(
        mockTenant.id
      );

      expect(retrievedTenant?.data).toEqual({
        ...updatedTenant,
        onboardedAt: updatedTenant.createdAt,
      });
      expect(retrievedTenant?.metadata).toEqual({ version: 2 });
    });

    it("SelfcareMappingCreated", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      await readModelService.upsertTenant(mockTenant, 1);

      const selfcareId = generateId();

      const updatedTenant: Tenant = {
        ...mockTenant,
        selfcareId,
      };
      const payload: SelfcareMappingCreatedV1 = {
        tenantId: mockTenant.id,
        selfcareId,
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "SelfcareMappingCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, readModelService);

      const retrievedTenant = await readModelService.getTenantById(
        mockTenant.id
      );

      expect(retrievedTenant?.data).toEqual(updatedTenant);
      expect(retrievedTenant?.metadata).toEqual({ version: 2 });

      vi.useRealTimers();
    });

    it("TenantMailAdded", async () => {
      await readModelService.upsertTenant(mockTenant, 1);

      const mailId = generateId();
      const updatedTenant: Tenant = {
        ...mockTenant,
        mails: [
          {
            id: mailId,
            createdAt: new Date(),
            kind: "CONTACT_EMAIL",
            address: "test@pagopa.it",
          },
        ],
      };
      const payload: TenantMailAddedV1 = {
        tenantId: updatedTenant.id,
        mailId,
        tenant: toTenantV1(updatedTenant),
      };

      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "TenantMailAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, readModelService);

      const retrievedTenant = await readModelService.getTenantById(
        mockTenant.id
      );

      expect(retrievedTenant?.data).toEqual({
        ...updatedTenant,
        onboardedAt: updatedTenant.createdAt,
      });
      expect(retrievedTenant?.metadata).toEqual({ version: 2 });
    });

    it("TenantMailDeleted", async () => {
      const mailId = generateId();
      const tenantWithMail: Tenant = {
        ...mockTenant,
        mails: [
          {
            id: mailId,
            createdAt: new Date(),
            kind: "CONTACT_EMAIL",
            address: "test@pagopa.it",
          },
        ],
      };
      await readModelService.upsertTenant(tenantWithMail, 1);

      const updatedTenant: Tenant = {
        ...mockTenant,
        mails: [],
      };
      const payload: TenantMailDeletedV1 = {
        tenantId: mockTenant.id,
        mailId,
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 2,
        type: "TenantMailDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, readModelService);

      const retrievedTenant = await readModelService.getTenantById(
        mockTenant.id
      );

      expect(retrievedTenant?.data).toEqual(updatedTenant);
      expect(retrievedTenant?.metadata).toEqual({ version: 2 });
    });
  });
});
