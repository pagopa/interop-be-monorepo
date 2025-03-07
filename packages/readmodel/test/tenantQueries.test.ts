/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  getMockTenantMail,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockVerifiedTenantAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import {
  TenantMail,
  CertifiedTenantAttribute,
  generateId,
  DelegationId,
  DeclaredTenantAttribute,
  TenantVerifier,
  TenantRevoker,
  VerifiedTenantAttribute,
  TenantFeatureCertifier,
  tenantFeatureType,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  ExternalId,
  Tenant,
  tenantKind,
  tenantUnitType,
  WithMetadata,
  TenantId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  generateCompleteExpectedTenantSQLObjects,
  initMockTenant,
  retrieveTenantSQLObjects,
  sortFeatures,
  sortTenants,
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
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifier,
        tenantRevoker,
        tenantFeatureCertifier,
        tenantFeatureDelegatedConsumer,
        tenantFeatureDelegatedProducer,
      } = initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(tenantForVerifying);
      await tenantReadModelService.upsertTenant(tenantForRevoking);
      await tenantReadModelService.upsertTenant(tenant);

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

      const {
        expectedTenantSQL,
        expectedMailsSQL,
        expectedCertifiedAttributesSQL,
        expectedDeclaredAttributesSQL,
        expectedVerifiedAttributesSQL,
        expectedVerifiedAttributeVerifiersSQL,
        expectedVerifiedAttributeRevokersSQL,
        expectedFeaturesSQL,
      } = generateCompleteExpectedTenantSQLObjects({
        tenant,
        tenantMails,
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifier,
        tenantRevoker,
        tenantFeatureCertifier,
        tenantFeatureDelegatedConsumer,
        tenantFeatureDelegatedProducer,
      });

      expect(retrievedTenantSQL).toMatchObject(expectedTenantSQL);
      expect(retrievedMailsSQL).toMatchObject(expectedMailsSQL);
      expect(retrievedCertifiedAttributesSQL).toMatchObject(
        expectedCertifiedAttributesSQL
      );
      expect(retrievedDeclaredAttributesSQL).toMatchObject(
        expectedDeclaredAttributesSQL
      );
      expect(retrievedVerifiedAttributesSQL).toMatchObject(
        expectedVerifiedAttributesSQL
      );
      expect(retrievedVerifiedAttributeVerifiersSQL).toMatchObject(
        expectedVerifiedAttributeVerifiersSQL
      );
      expect(retrievedVerifiedAttributeRevokersSQL).toMatchObject(
        expectedVerifiedAttributeRevokersSQL
      );
      expect(retrievedFeaturesSQL).toMatchObject(
        expect.arrayContaining(expectedFeaturesSQL)
      );
    });
    it("should add an incomplete (*only* mandatory fields) tenant", async () => {
      const isTenantComplete = false;
      const {
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifier,
        tenantRevoker,
        tenantFeatureCertifier,
        tenantFeatureDelegatedConsumer,
        tenantFeatureDelegatedProducer,
      } = initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(tenantForVerifying);
      await tenantReadModelService.upsertTenant(tenantForRevoking);
      await tenantReadModelService.upsertTenant(tenant);

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

      const {
        expectedTenantSQL,
        expectedMailsSQL,
        expectedCertifiedAttributesSQL,
        expectedDeclaredAttributesSQL,
        expectedVerifiedAttributesSQL,
        expectedVerifiedAttributeVerifiersSQL,
        expectedVerifiedAttributeRevokersSQL,
        expectedFeaturesSQL,
      } = generateCompleteExpectedTenantSQLObjects({
        tenant,
        tenantMails,
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifier,
        tenantRevoker,
        tenantFeatureCertifier,
        tenantFeatureDelegatedConsumer,
        tenantFeatureDelegatedProducer,
      });

      expect(retrievedTenantSQL).toMatchObject(expectedTenantSQL);
      expect(retrievedMailsSQL).toMatchObject(expectedMailsSQL);
      expect(retrievedCertifiedAttributesSQL).toMatchObject(
        expectedCertifiedAttributesSQL
      );
      expect(retrievedDeclaredAttributesSQL).toMatchObject(
        expectedDeclaredAttributesSQL
      );
      expect(retrievedVerifiedAttributesSQL).toMatchObject(
        expectedVerifiedAttributesSQL
      );
      expect(retrievedVerifiedAttributeVerifiersSQL).toMatchObject(
        expectedVerifiedAttributeVerifiersSQL
      );
      expect(retrievedVerifiedAttributeRevokersSQL).toMatchObject(
        expectedVerifiedAttributeRevokersSQL
      );
      expect(retrievedFeaturesSQL?.sort(sortFeatures)).toMatchObject(
        expect.arrayContaining(expectedFeaturesSQL.sort(sortFeatures))
      );
    });
    it("should update a complete (*all* fields) tenant", async () => {
      const isTenantComplete = true;
      const {
        tenantBeforeUpdate,
        tenant,
        tenantForVerifying,
        tenantForRevoking,
        tenantMails,
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifier,
        tenantRevoker,
        tenantFeatureCertifier,
        tenantFeatureDelegatedConsumer,
        tenantFeatureDelegatedProducer,
      } = initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(tenantForVerifying);
      await tenantReadModelService.upsertTenant(tenantForRevoking);
      await tenantReadModelService.upsertTenant(tenantBeforeUpdate);
      await tenantReadModelService.upsertTenant(tenant);

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

      const {
        expectedTenantSQL,
        expectedMailsSQL,
        expectedCertifiedAttributesSQL,
        expectedDeclaredAttributesSQL,
        expectedVerifiedAttributesSQL,
        expectedVerifiedAttributeVerifiersSQL,
        expectedVerifiedAttributeRevokersSQL,
        expectedFeaturesSQL,
      } = generateCompleteExpectedTenantSQLObjects({
        tenant,
        tenantMails,
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifier,
        tenantRevoker,
        tenantFeatureCertifier,
        tenantFeatureDelegatedConsumer,
        tenantFeatureDelegatedProducer,
      });

      expect(retrievedTenantSQL).toMatchObject(expectedTenantSQL);
      expect(retrievedMailsSQL).toMatchObject(expectedMailsSQL);
      expect(retrievedCertifiedAttributesSQL).toMatchObject(
        expectedCertifiedAttributesSQL
      );
      expect(retrievedDeclaredAttributesSQL).toMatchObject(
        expectedDeclaredAttributesSQL
      );
      expect(retrievedVerifiedAttributesSQL).toMatchObject(
        expectedVerifiedAttributesSQL
      );
      expect(retrievedVerifiedAttributeVerifiersSQL).toMatchObject(
        expectedVerifiedAttributeVerifiersSQL
      );
      expect(retrievedVerifiedAttributeRevokersSQL).toMatchObject(
        expectedVerifiedAttributeRevokersSQL
      );
      expect(retrievedFeaturesSQL?.sort(sortFeatures)).toMatchObject(
        expectedFeaturesSQL.sort(sortFeatures)
      );
    });
  });
  describe("Get a Tenant", () => {
    it("should get a tenant from a tenantId", async () => {
      const isTenantComplete = true;
      const { tenant, tenantForVerifying, tenantForRevoking } =
        initMockTenant(isTenantComplete);

      await tenantReadModelService.upsertTenant(tenantForVerifying);
      await tenantReadModelService.upsertTenant(tenantForRevoking);
      await tenantReadModelService.upsertTenant(tenant);

      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenant.data.id
      );
      // checking features: doing a check on array features separately otherwise toMatchObject fails on array equality
      expect(retrievedTenant?.data.features).toEqual(
        expect.arrayContaining(tenant?.data.features)
      );
      // overwriting features in expectedTenant so toMatchObject dont fails to check array equality
      const expectedTenant = {
        ...tenant,
        data: { features: retrievedTenant?.data.features },
      };
      expect(retrievedTenant).toMatchObject(expectedTenant);
    });
    it("should *not* get a tenant from a tenantId", async () => {
      const tenantId = generateId<TenantId>();
      const retrievedTenant = await tenantReadModelService.getTenantById(
        tenantId
      );

      expect(retrievedTenant).toBeUndefined();
    });
  });
  describe("Get all Tenants", () => {
    it("should get all tenants", async () => {
      const tenantForVerifying: WithMetadata<Tenant> = {
        data: {
          ...getMockTenant(),
        },
        metadata: { version: 1 },
      };
      const tenantForRevoking: WithMetadata<Tenant> = {
        data: {
          ...getMockTenant(),
        },
        metadata: { version: 1 },
      };
      const delegationId = generateId<DelegationId>();
      const tenantVerifier: TenantVerifier = {
        id: tenantForVerifying.data.id,
        verificationDate: new Date(),
        expirationDate: new Date(),
        extensionDate: new Date(),
        delegationId,
      };
      const tenantRevoker: TenantRevoker = {
        id: tenantForRevoking.data.id,
        verificationDate: new Date(),
        revocationDate: new Date(),
        expirationDate: new Date(),
        extensionDate: new Date(),
        delegationId,
      };

      const tenantMail: TenantMail = {
        ...getMockTenantMail(),
        description: "mail description",
      };
      const tenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        assignmentTimestamp: new Date(),
        revocationTimestamp: new Date(),
      };

      const tenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        assignmentTimestamp: new Date(),
        revocationTimestamp: new Date(),
        delegationId,
      };

      const tenantVerifiedAttribute: VerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [tenantVerifier],
        revokedBy: [tenantRevoker],
        assignmentTimestamp: new Date(),
      };

      const tenantFeatureCertifier: TenantFeatureCertifier = {
        type: tenantFeatureType.persistentCertifier,
        certifierId: generateId(),
      };

      const tenantFeatureDelegatedConsumer: TenantFeatureDelegatedConsumer = {
        type: tenantFeatureType.delegatedConsumer,
        availabilityTimestamp: new Date(),
      };

      const tenantFeatureDelegatedProducer: TenantFeatureDelegatedProducer = {
        type: tenantFeatureType.delegatedProducer,
        availabilityTimestamp: new Date(),
      };

      const selfcareId = generateId();

      const externalId: ExternalId = {
        origin: "IPA",
        value: generateId(),
      };
      const tenant1: WithMetadata<Tenant> = {
        data: {
          ...getMockTenant(),
          selfcareId,
          kind: tenantKind.PA,
          subUnitType: tenantUnitType.AOO,
          externalId,
          updatedAt: new Date(),
          mails: [tenantMail],
          attributes: [
            tenantCertifiedAttribute,
            tenantDeclaredAttribute,
            tenantVerifiedAttribute,
          ],
          features: [
            tenantFeatureDelegatedProducer,
            tenantFeatureDelegatedConsumer,
            tenantFeatureCertifier,
          ],
        },
        metadata: { version: 1 },
      };
      const tenantMail2: TenantMail = {
        ...getMockTenantMail(),
        description: "mail description",
      };
      const tenant2: WithMetadata<Tenant> = {
        data: {
          ...getMockTenant(),
          selfcareId,
          kind: tenantKind.PA,
          subUnitType: tenantUnitType.AOO,
          externalId,
          updatedAt: new Date(),
          mails: [tenantMail2],
          attributes: [
            tenantCertifiedAttribute,
            tenantDeclaredAttribute,
            tenantVerifiedAttribute,
          ],
          features: [
            tenantFeatureDelegatedProducer,
            tenantFeatureDelegatedConsumer,
            tenantFeatureCertifier,
          ],
        },
        metadata: { version: 1 },
      };

      await tenantReadModelService.upsertTenant(tenantForVerifying);
      await tenantReadModelService.upsertTenant(tenantForRevoking);
      await tenantReadModelService.upsertTenant(tenant1);
      await tenantReadModelService.upsertTenant(tenant2);

      const retrievedTenants = await tenantReadModelService.getAllTenants();

      expect(retrievedTenants.sort(sortTenants)).toMatchObject(
        [tenant1, tenant2, tenantForVerifying, tenantForRevoking].sort(
          sortTenants
        )
      );
    });
    it("should *not* get any tenants", async () => {
      const retrievedTenants = await tenantReadModelService.getAllTenants();
      expect(retrievedTenants).toHaveLength(0);
    });
  });
  describe("Delete a Tenant", () => {
    it.skip("should delete a tenant from a tenantId", () => {
      expect(1).toEqual(0);
    });
  });
});
