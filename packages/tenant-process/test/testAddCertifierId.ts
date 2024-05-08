/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceTenantPromotedToCertifierV2,
  Tenant,
  generateId,
  protobufDecoder,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
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
    let payload: CertifierPromotionPayload;

    beforeAll(async () => {
      payload = {
        certifierId: generateId(),
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("should write on event-store for the addition of the certifierId to the tenant", async () => {
      const mockTenant = getMockTenant();
      await addOneTenant(mockTenant, postgresDB, tenants);
      await tenantService.addCertifierId(mockTenant.id, generateId(), payload);
      const writtenEvent = await readLastTenantEvent(mockTenant.id, postgresDB);

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
