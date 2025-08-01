import { sortTenant } from "pagopa-interop-commons-test";
import { WithMetadata, Tenant } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  initMockTenant,
  retrieveTenantSQLObjects,
  tenantReadModelService,
  tenantWriterService,
} from "./utils.js";

describe("Tenant Queries", () => {
  describe("Upsert Tenant", () => {
    it("should add a complete (*all* fields) tenant", async () => {
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttributes,
        tenantDeclaredAttributes,
        tenantVerifiedAttributes,
        tenantFeatures,
      } = initMockTenant({ isTenantComplete: true });

      await tenantWriterService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenant.data,
        tenant.metadata.version
      );

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      const {
        retrievedTenantSQL,
        retrievedMailsSQL,
        retrievedCertifiedAttributesSQL,
        retrievedDeclaredAttributesSQL,
        retrievedVerifiedAttributesSQL,
        retrievedVerifiedAttributeVerifiersSQL,
        retrievedVerifiedAttributeRevokersSQL,
        retrievedFeaturesSQL,
      } = await retrieveTenantSQLObjects(tenant);
      expect(retrievedTenantSQL).toBeDefined();
      expect(retrievedMailsSQL).toHaveLength(tenantMails.length);
      expect(retrievedCertifiedAttributesSQL).toHaveLength(
        tenantCertifiedAttributes.length
      );
      expect(retrievedDeclaredAttributesSQL).toHaveLength(
        tenantDeclaredAttributes.length
      );
      expect(retrievedVerifiedAttributesSQL).toHaveLength(
        tenantVerifiedAttributes.length
      );
      expect(retrievedVerifiedAttributeVerifiersSQL).toHaveLength(1);
      expect(retrievedVerifiedAttributeRevokersSQL).toHaveLength(1);
      expect(retrievedFeaturesSQL).toHaveLength(tenantFeatures.length);

      expect(sortTenant(retrievedTenant)).toStrictEqual(sortTenant(tenant));
    });
    it("should add an incomplete (*only* mandatory fields) tenant", async () => {
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttributes,
        tenantDeclaredAttributes,
        tenantVerifiedAttributes,
        tenantFeatures,
      } = initMockTenant({ isTenantComplete: false });

      await tenantWriterService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenant.data,
        tenant.metadata.version
      );

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      const {
        retrievedTenantSQL,
        retrievedMailsSQL,
        retrievedCertifiedAttributesSQL,
        retrievedDeclaredAttributesSQL,
        retrievedVerifiedAttributesSQL,
        retrievedVerifiedAttributeVerifiersSQL,
        retrievedVerifiedAttributeRevokersSQL,
        retrievedFeaturesSQL,
      } = await retrieveTenantSQLObjects(tenant);
      expect(retrievedTenantSQL).toBeDefined();
      expect(retrievedMailsSQL).toHaveLength(tenantMails.length);
      expect(retrievedCertifiedAttributesSQL).toHaveLength(
        tenantCertifiedAttributes.length
      );
      expect(retrievedDeclaredAttributesSQL).toHaveLength(
        tenantDeclaredAttributes.length
      );
      expect(retrievedVerifiedAttributesSQL).toHaveLength(
        tenantVerifiedAttributes.length
      );
      expect(retrievedVerifiedAttributeVerifiersSQL).toHaveLength(1);
      expect(retrievedVerifiedAttributeRevokersSQL).toHaveLength(1);
      expect(retrievedFeaturesSQL).toHaveLength(tenantFeatures.length);

      expect(sortTenant(retrievedTenant)).toStrictEqual(sortTenant(tenant));
    });
    it("should update a complete (*all* fields) tenant", async () => {
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttributes,
        tenantDeclaredAttributes,
        tenantVerifiedAttributes,
        tenantFeatures,
      } = initMockTenant({ isTenantComplete: true });
      await tenantWriterService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenant.data,
        tenant.metadata.version
      );

      const updatedTenant: WithMetadata<Tenant> = {
        data: {
          ...tenant.data,
          name: "An updated Tenant",
          updatedAt: new Date(),
        },
        metadata: { version: 2 },
      };

      await tenantWriterService.upsertTenant(
        updatedTenant.data,
        updatedTenant.metadata.version
      );

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      const {
        retrievedTenantSQL,
        retrievedMailsSQL,
        retrievedCertifiedAttributesSQL,
        retrievedDeclaredAttributesSQL,
        retrievedVerifiedAttributesSQL,
        retrievedVerifiedAttributeVerifiersSQL,
        retrievedVerifiedAttributeRevokersSQL,
        retrievedFeaturesSQL,
      } = await retrieveTenantSQLObjects(tenant);
      expect(retrievedTenantSQL).toBeDefined();
      expect(retrievedMailsSQL).toHaveLength(tenantMails.length);
      expect(retrievedCertifiedAttributesSQL).toHaveLength(
        tenantCertifiedAttributes.length
      );
      expect(retrievedDeclaredAttributesSQL).toHaveLength(
        tenantDeclaredAttributes.length
      );
      expect(retrievedVerifiedAttributesSQL).toHaveLength(
        tenantVerifiedAttributes.length
      );
      expect(retrievedVerifiedAttributeVerifiersSQL).toHaveLength(1);
      expect(retrievedVerifiedAttributeRevokersSQL).toHaveLength(1);
      expect(retrievedFeaturesSQL).toHaveLength(tenantFeatures.length);

      expect(sortTenant(retrievedTenant)).toStrictEqual(
        sortTenant(updatedTenant)
      );
    });
  });

  describe("Delete a Tenant", () => {
    it("should delete a tenant from a tenantId", async () => {
      const { tenant, tenantForVerifying, tenantForRevoking } = initMockTenant({
        isTenantComplete: true,
      });

      await tenantWriterService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantWriterService.upsertTenant(
        tenant.data,
        tenant.metadata.version
      );

      const retrievedInsertedTenant =
        await tenantReadModelService.getTenantById(tenant.data.id);

      await tenantWriterService.deleteTenantById(
        tenant.data.id,
        tenant.metadata.version
      );

      const deletedInsertedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      const {
        retrievedTenantSQL,
        retrievedMailsSQL,
        retrievedCertifiedAttributesSQL,
        retrievedDeclaredAttributesSQL,
        retrievedVerifiedAttributesSQL,
        retrievedVerifiedAttributeVerifiersSQL,
        retrievedVerifiedAttributeRevokersSQL,
        retrievedFeaturesSQL,
      } = await retrieveTenantSQLObjects(tenant);

      expect(sortTenant(retrievedInsertedTenant)).toStrictEqual(
        sortTenant(tenant)
      );

      expect(deletedInsertedTenant).toBeUndefined();
      expect(retrievedTenantSQL).toBeUndefined();
      expect(retrievedMailsSQL).toBeUndefined();
      expect(retrievedCertifiedAttributesSQL).toBeUndefined();
      expect(retrievedDeclaredAttributesSQL).toBeUndefined();
      expect(retrievedVerifiedAttributesSQL).toBeUndefined();
      expect(retrievedVerifiedAttributeVerifiersSQL).toBeUndefined();
      expect(retrievedVerifiedAttributeRevokersSQL).toBeUndefined();
      expect(retrievedFeaturesSQL).toBeUndefined();
    });
  });
});
