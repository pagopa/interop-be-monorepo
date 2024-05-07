import { fail } from "assert";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceTenantPromotedToCertifierV2,
  Tenant,
  generateId,
  protobufDecoder,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  tenantNotFound,
  tenatIsAlreadyACertifier,
} from "../src/model/domain/errors.js";
import { CertifierPromotionPayload } from "../src/model/domain/models.js";
import { addOneTenant, getMockTenant, readLastTenantEvent } from "./utils.js";
import {
  postgresDB,
  tenants,
  tenantService,
} from "./tenant.integration.test.js";

export const testAddCertifierId = (): ReturnType<typeof describe> =>
  describe("addCertifierId", async () => {
    const payload: CertifierPromotionPayload = {
      certifierId: generateId(),
    };

    it("should write on event-store for the addition of the certifierId to the tenant", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
      const mockTenant = getMockTenant();
      await addOneTenant(mockTenant, postgresDB, tenants);
      await tenantService.addCertifierId(mockTenant.id, generateId(), payload);
      const writtenEvent = await readLastTenantEvent(mockTenant.id, postgresDB);
      if (!writtenEvent) {
        fail("Creation failed: tenant not found in event-store");
      }
      expect(writtenEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "1",
        type: "MaintenanceTenantPromotedToCertifier",
        event_version: 2,
      });
      const writtenPayload: MaintenanceTenantPromotedToCertifierV2 | undefined =
        protobufDecoder(MaintenanceTenantPromotedToCertifierV2).parse(
          writtenEvent.data
        );

      const expectedTenant: Tenant = {
        ...mockTenant,
        features: [
          {
            type: "PersistentCertifier",
            certifierId: payload.certifierId,
          },
        ],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
      vi.useRealTimers();
    });
    it("Should throw tenantNotFound when tenant doesn't exist", async () => {
      const mockTenant = getMockTenant();

      expect(
        tenantService.addCertifierId(mockTenant.id, generateId(), payload)
      ).rejects.toThrowError(tenantNotFound(mockTenant.id));
    });
    it("Should throw tenantIsAlreadyACertifier if the organization is a certifier", async () => {
      const certifierId = generateId();
      const payload: CertifierPromotionPayload = {
        certifierId,
      };

      const certifierTenant: Tenant = {
        ...getMockTenant(),
        features: [
          {
            type: "PersistentCertifier",
            certifierId,
          },
        ],
      };

      await addOneTenant(certifierTenant, postgresDB, tenants);
      expect(
        tenantService.addCertifierId(certifierTenant.id, generateId(), payload)
      ).rejects.toThrowError(
        tenatIsAlreadyACertifier(certifierTenant.id, payload.certifierId)
      );
    });
  });
