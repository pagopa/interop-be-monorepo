import { describe, it, expect } from "vitest";
import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
  sortTenant,
} from "pagopa-interop-commons-test";
import {
  DelegationId,
  generateId,
  Tenant,
  tenantFeatureType,
  tenantKind,
  TenantRevoker,
  tenantUnitType,
  TenantVerifier,
  WithMetadata,
} from "pagopa-interop-models";
import { upsertTenant } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { tenantReadModelService } from "./tenantUtils.js";

describe("Tenant Queries", () => {
  describe("Get a Tenant", () => {
    it("should get a tenant from a tenantId", async () => {
      const delegationId = generateId<DelegationId>();

      const tenantForVerifying = getMockTenant();
      await upsertTenant(readModelDB, tenantForVerifying, 1);
      const tenantForRevoking = getMockTenant();
      await upsertTenant(readModelDB, tenantForRevoking, 1);

      const tenantVerifier: TenantVerifier = {
        id: tenantForVerifying.id,
        verificationDate: new Date(),
        expirationDate: new Date(),
        extensionDate: new Date(),
        delegationId,
      };
      const tenantRevoker: TenantRevoker = {
        id: tenantForRevoking.id,
        verificationDate: new Date(),
        revocationDate: new Date(),
        expirationDate: new Date(),
        extensionDate: new Date(),
        delegationId,
      };

      const tenant: WithMetadata<Tenant> = {
        data: {
          ...getMockTenant(),
          kind: tenantKind.PA,
          updatedAt: new Date(),
          onboardedAt: new Date(),
          subUnitType: tenantUnitType.AOO,
          mails: [getMockTenantMail(), getMockTenantMail()],
          features: [
            {
              type: tenantFeatureType.persistentCertifier,
              certifierId: generateId(),
            },
            {
              type: tenantFeatureType.delegatedConsumer,
              availabilityTimestamp: new Date(),
            },
            {
              type: tenantFeatureType.delegatedProducer,
              availabilityTimestamp: new Date(),
            },
          ],
          attributes: [
            {
              ...getMockCertifiedTenantAttribute(),
              assignmentTimestamp: new Date(),
              revocationTimestamp: new Date(),
            },
            {
              ...getMockDeclaredTenantAttribute(),
              assignmentTimestamp: new Date(),
              revocationTimestamp: new Date(),
              delegationId,
            },
            {
              ...getMockVerifiedTenantAttribute(),
              verifiedBy: [tenantVerifier],
              revokedBy: [tenantRevoker],
              assignmentTimestamp: new Date(),
            },
          ],
        },
        metadata: {
          version: 1,
        },
      };

      await upsertTenant(readModelDB, tenant.data, 1);

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      expect(sortTenant(retrievedTenant)).toStrictEqual(sortTenant(tenant));
    });
    it("should *not* get a tenant from a tenantId", async () => {
      await upsertTenant(readModelDB, getMockTenant(), 1);

      const retrievedTenant = await tenantReadModelService.getTenantById(
        generateId()
      );

      expect(retrievedTenant).toBeUndefined();
    });
  });
});
