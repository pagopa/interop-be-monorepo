/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test/index.js";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  DelegationId,
  ExternalId,
  generateId,
  Tenant,
  TenantFeatureCertifier,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  tenantFeatureType,
  tenantKind,
  TenantMail,
  TenantRevoker,
  tenantUnitType,
  TenantVerifier,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantFeatureSQL,
  TenantMailSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-readmodel-models";
import { splitTenantIntoObjectsSQL } from "../src/tenant/splitters.js";

describe("Tenant splitters", () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  describe("Tenant splitter", () => {
    it("should convert a Tenant into TenantSQL and related items", () => {
      const tenantMail: TenantMail = {
        ...getMockTenantMail(),
        description: "mail description",
      };
      const tenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        assignmentTimestamp: new Date(),
        revocationTimestamp: new Date(),
      };
      const delegationId = generateId<DelegationId>();
      const tenantDelcaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        assignmentTimestamp: new Date(),
        revocationTimestamp: new Date(),
        delegationId,
      };

      const tenantVerifier: TenantVerifier = {
        id: generateId(),
        verificationDate: new Date(),
        expirationDate: new Date(),
        extensionDate: new Date(),
        delegationId,
      };
      const tenantRevoker: TenantRevoker = {
        id: generateId(),
        verificationDate: new Date(),
        revocationDate: new Date(),
        expirationDate: new Date(),
        extensionDate: new Date(),
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

      const TenantFeatureDelegatedConsumer: TenantFeatureDelegatedConsumer = {
        type: tenantFeatureType.delegatedConsumer,
        availabilityTimestamp: new Date(),
      };

      const TenantFeatureDelegatedProducer: TenantFeatureDelegatedProducer = {
        type: tenantFeatureType.delegatedProducer,
        availabilityTimestamp: new Date(),
      };

      const selfcareId = generateId();

      const externalId: ExternalId = {
        origin: "IPA",
        value: generateId(),
      };
      const tenant: Tenant = {
        ...getMockTenant(),
        selfcareId,
        kind: tenantKind.PA,
        subUnitType: tenantUnitType.AOO,
        externalId,
        updatedAt: new Date(),
        mails: [tenantMail],
        attributes: [
          tenantCertifiedAttribute,
          tenantDelcaredAttribute,
          tenantVerifiedAttribute,
        ],
        features: [
          tenantFeatureCertifier,
          TenantFeatureDelegatedConsumer,
          TenantFeatureDelegatedProducer,
        ],
      };

      const {
        tenantSQL,
        tenantMailsSQL,
        tenantCertifiedAttributesSQL,
        tenantDeclaredAttributesSQL,
        tenantVerifiedAttributesSQL,
        tenantVerifiedAttributeVerifiersSQL,
        tenantVerifiedAttributeRevokersSQL,
        tenantFeaturesSQL,
      } = splitTenantIntoObjectsSQL(tenant, 1);

      const expectedTenantSQL: TenantSQL = {
        id: tenant.id,
        metadataVersion: 1,
        kind: tenantKind.PA,
        selfcareId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: tenant.name,
        onboardedAt: new Date().toISOString(),
        subUnitType: tenantUnitType.AOO,
        externalIdOrigin: externalId.origin,
        externalIdValue: externalId.value,
      };

      const expectedTenantMailSQL: TenantMailSQL = {
        id: tenantMail.id,
        kind: tenantMail.kind,
        createdAt: tenantMail.createdAt.toISOString(),
        metadataVersion: 1,
        tenantId: tenant.id,
        address: tenantMail.address,
        description: "mail description",
      };

      const expectedTenantCertifiedAttributeSQL: TenantCertifiedAttributeSQL = {
        metadataVersion: 1,
        tenantId: tenant.id,
        attributeId: tenantCertifiedAttribute.id,
        assignmentTimestamp: new Date().toISOString(),
        revocationTimestamp: new Date().toISOString(),
      };

      const expectedTenantDeclaredAttributeSQL: TenantDeclaredAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantDelcaredAttribute.id,
        assignmentTimestamp: new Date().toISOString(),
        revocationTimestamp: new Date().toISOString(),
        delegationId,
      };

      const expectedTenantVerfiedAttributeSQL: TenantVerifiedAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantVerifiedAttribute.id,
        assignmentTimestamp: new Date().toISOString(),
      };

      const expectedTenantVerifierSQL: TenantVerifiedAttributeVerifierSQL = {
        tenantVerifierId: tenantVerifier.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: new Date().toISOString(),
        expirationDate: new Date().toISOString(),
        extensionDate: new Date().toISOString(),
      };

      const expectedTenantRevokerSQL: TenantVerifiedAttributeRevokerSQL = {
        tenantRevokerId: tenantRevoker.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: new Date().toISOString(),
        expirationDate: new Date().toISOString(),
        extensionDate: new Date().toISOString(),
        revocationDate: new Date().toISOString(),
      };

      const expectedTenantFeatureCertifierSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.persistentCertifier,
        certifierId: tenantFeatureCertifier.certifierId,
        availabilityTimestamp: null,
      };
      const expectedTenantFeatureDelegatedConsumerSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.delegatedConsumer,
        certifierId: null,
        availabilityTimestamp: new Date().toISOString(),
      };
      const expectedTenantFeatureDelegatedProducerSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.delegatedProducer,
        certifierId: null,
        availabilityTimestamp: new Date().toISOString(),
      };

      expect(tenantSQL).toEqual(expectedTenantSQL);
      expect(tenantMailsSQL).toEqual([expectedTenantMailSQL]);
      expect(tenantCertifiedAttributesSQL).toEqual([
        expectedTenantCertifiedAttributeSQL,
      ]);
      expect(tenantDeclaredAttributesSQL).toEqual([
        expectedTenantDeclaredAttributeSQL,
      ]);
      expect(tenantVerifiedAttributesSQL).toEqual([
        expectedTenantVerfiedAttributeSQL,
      ]);
      expect(tenantVerifiedAttributeVerifiersSQL).toEqual([
        expectedTenantVerifierSQL,
      ]);
      expect(tenantVerifiedAttributeRevokersSQL).toEqual([
        expectedTenantRevokerSQL,
      ]);
      expect(tenantFeaturesSQL).toEqual(
        expect.arrayContaining([
          expectedTenantFeatureCertifierSQL,
          expectedTenantFeatureDelegatedConsumerSQL,
          expectedTenantFeatureDelegatedProducerSQL,
        ])
      );
    });
    it("should convert undefined into null", () => {
      const tenantMail: TenantMail = {
        ...getMockTenantMail(),
        description: undefined,
      };
      const tenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        assignmentTimestamp: new Date(),
        revocationTimestamp: undefined,
      };
      const delegationId = generateId<DelegationId>();
      const tenantDelcaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        assignmentTimestamp: new Date(),
        revocationTimestamp: undefined,
        delegationId,
      };

      const tenantVerifier: TenantVerifier = {
        id: generateId(),
        verificationDate: new Date(),
        expirationDate: undefined,
        extensionDate: undefined,
        delegationId,
      };
      const tenantRevoker: TenantRevoker = {
        id: generateId(),
        verificationDate: new Date(),
        revocationDate: new Date(),
        expirationDate: undefined,
        extensionDate: undefined,
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

      const TenantFeatureDelegatedConsumer: TenantFeatureDelegatedConsumer = {
        type: tenantFeatureType.delegatedConsumer,
        availabilityTimestamp: new Date(),
      };

      const TenantFeatureDelegatedProducer: TenantFeatureDelegatedProducer = {
        type: tenantFeatureType.delegatedProducer,
        availabilityTimestamp: new Date(),
      };

      const selfcareId = generateId();

      const externalId: ExternalId = {
        origin: "IPA",
        value: generateId(),
      };
      const tenant: Tenant = {
        ...getMockTenant(),
        selfcareId,
        kind: undefined,
        subUnitType: undefined,
        externalId,
        updatedAt: undefined,
        mails: [tenantMail],
        attributes: [
          tenantCertifiedAttribute,
          tenantDelcaredAttribute,
          tenantVerifiedAttribute,
        ],
        features: [
          tenantFeatureCertifier,
          TenantFeatureDelegatedConsumer,
          TenantFeatureDelegatedProducer,
        ],
      };

      const {
        tenantSQL,
        tenantMailsSQL,
        tenantCertifiedAttributesSQL,
        tenantDeclaredAttributesSQL,
        tenantVerifiedAttributesSQL,
        tenantVerifiedAttributeVerifiersSQL,
        tenantVerifiedAttributeRevokersSQL,
        tenantFeaturesSQL,
      } = splitTenantIntoObjectsSQL(tenant, 1);

      const expectedTenantSQL: TenantSQL = {
        id: tenant.id,
        metadataVersion: 1,
        kind: null,
        selfcareId,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        name: tenant.name,
        onboardedAt: new Date().toISOString(),
        subUnitType: null,
        externalIdOrigin: externalId.origin,
        externalIdValue: externalId.value,
      };

      const expectedTenantMailSQL: TenantMailSQL = {
        id: tenantMail.id,
        kind: tenantMail.kind,
        createdAt: tenantMail.createdAt.toISOString(),
        metadataVersion: 1,
        tenantId: tenant.id,
        address: tenantMail.address,
        description: null,
      };

      const expectedTenantCertifiedAttributeSQL: TenantCertifiedAttributeSQL = {
        metadataVersion: 1,
        tenantId: tenant.id,
        attributeId: tenantCertifiedAttribute.id,
        assignmentTimestamp: new Date().toISOString(),
        revocationTimestamp: null,
      };

      const expectedTenantDeclaredAttributeSQL: TenantDeclaredAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantDelcaredAttribute.id,
        assignmentTimestamp: new Date().toISOString(),
        revocationTimestamp: null,
        delegationId,
      };

      const expectedTenantVerfiedAttributeSQL: TenantVerifiedAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantVerifiedAttribute.id,
        assignmentTimestamp: new Date().toISOString(),
      };

      const expectedTenantVerifierSQL: TenantVerifiedAttributeVerifierSQL = {
        tenantVerifierId: tenantVerifier.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: new Date().toISOString(),
        expirationDate: null,
        extensionDate: null,
      };

      const expectedTenantRevokerSQL: TenantVerifiedAttributeRevokerSQL = {
        tenantRevokerId: tenantRevoker.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: new Date().toISOString(),
        expirationDate: null,
        extensionDate: null,
        revocationDate: new Date().toISOString(),
      };

      const expectedTenantFeatureCertifierSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.persistentCertifier,
        certifierId: tenantFeatureCertifier.certifierId,
        availabilityTimestamp: null,
      };
      const expectedTenantFeatureDelegatedConsumerSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.delegatedConsumer,
        certifierId: null,
        availabilityTimestamp: new Date().toISOString(),
      };
      const expectedTenantFeatureDelegatedProducerSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.delegatedProducer,
        certifierId: null,
        availabilityTimestamp: new Date().toISOString(),
      };

      expect(tenantSQL).toEqual(expectedTenantSQL);
      expect(tenantMailsSQL).toEqual([expectedTenantMailSQL]);
      expect(tenantCertifiedAttributesSQL).toEqual([
        expectedTenantCertifiedAttributeSQL,
      ]);
      expect(tenantDeclaredAttributesSQL).toEqual([
        expectedTenantDeclaredAttributeSQL,
      ]);
      expect(tenantVerifiedAttributesSQL).toEqual([
        expectedTenantVerfiedAttributeSQL,
      ]);
      expect(tenantVerifiedAttributeVerifiersSQL).toEqual([
        expectedTenantVerifierSQL,
      ]);
      expect(tenantVerifiedAttributeRevokersSQL).toEqual([
        expectedTenantRevokerSQL,
      ]);
      expect(tenantFeaturesSQL).toEqual(
        expect.arrayContaining([
          expectedTenantFeatureCertifierSQL,
          expectedTenantFeatureDelegatedConsumerSQL,
          expectedTenantFeatureDelegatedProducerSQL,
        ])
      );
    });
  });
});
