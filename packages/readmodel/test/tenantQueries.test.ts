/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, it, expect } from "vitest";

import { WithMetadata, Tenant } from "pagopa-interop-models";
import {
  initMockTenant,
  retrieveTenantSQLObjects,
  tenantReadModelService,
} from "./utils.js";

describe("Tenant Queries", () => {
  describe("Upsert Tenant", () => {
    it("should add a complete (*all* fields) tenant", async () => {
      const isTenantComplete = true;
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttributes,
        tenantDeclaredAttributes,
        tenantVerifiedAttributes,
        tenantFeatures,
      } = initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantReadModelService.upsertTenant(
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
      } = await retrieveTenantSQLObjects(tenant, isTenantComplete);
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

      expect(retrievedTenant).toStrictEqual(tenant);
    });
    it("should add an incomplete (*only* mandatory fields) tenant", async () => {
      const isTenantComplete = false;
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttributes,
        tenantDeclaredAttributes,
        tenantVerifiedAttributes,
        tenantFeatures,
      } = initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantReadModelService.upsertTenant(
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
      } = await retrieveTenantSQLObjects(tenant, isTenantComplete);
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

      expect(retrievedTenant).toStrictEqual(tenant);
    });
    it("should update a complete (*all* fields) tenant", async () => {
      const isTenantComplete = true;
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttributes,
        tenantDeclaredAttributes,
        tenantVerifiedAttributes,
        tenantFeatures,
      } = initMockTenant(isTenantComplete);
      await tenantReadModelService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantReadModelService.upsertTenant(
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

      await tenantReadModelService.upsertTenant(
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
      } = await retrieveTenantSQLObjects(tenant, isTenantComplete);
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

      expect(retrievedTenant).toStrictEqual(updatedTenant);
    });
  });
  describe("Get a Tenant", () => {
    it("should get a tenant from a tenantId", async () => {
      const isTenantComplete = true;
      const { tenant, tenantForVerifying, tenantForRevoking } =
        initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenant.data,
        tenant.metadata.version
      );

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      expect(retrievedTenant).toStrictEqual(tenant);
      // is sorting necessary?
      // expect(sortATenant(retrievedTenant!)).toStrictEqual(sortATenant(tenant));
    });
    it("should *not* get a tenant from a tenantId", async () => {
      const { tenant, tenantForVerifying, tenantForRevoking } =
        initMockTenant();
      await tenantReadModelService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );

      expect(retrievedTenant).toBeUndefined();
    });
  });
  describe("Delete a Tenant", () => {
    it("should delete a tenant from a tenantId", async () => {
      const isTenantComplete = true;
      const { tenant, tenantForVerifying, tenantForRevoking } =
        initMockTenant();

      await tenantReadModelService.upsertTenant(
        tenantForVerifying.data,
        tenantForVerifying.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenantForRevoking.data,
        tenantForRevoking.metadata.version
      );
      await tenantReadModelService.upsertTenant(
        tenant.data,
        tenant.metadata.version
      );

      const retrievedInsertedTenant =
        await tenantReadModelService.getTenantById(tenant.data.id);

      await tenantReadModelService.deleteTenantById(
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
      } = await retrieveTenantSQLObjects(tenant, isTenantComplete);

      expect(retrievedInsertedTenant).toStrictEqual(tenant);

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
