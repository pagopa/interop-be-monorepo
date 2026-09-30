/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockCertifiedDiscreteTenantAttribute,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
  getMockTenantRemoteId,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  CertifiedDiscreteTenantAttribute,
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
  TenantRemoteId,
  TenantRevoker,
  tenantUnitType,
  TenantVerifier,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import {
  TenantCertifiedAttributeSQL,
  TenantCertifiedDiscreteAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantFeatureSQL,
  TenantMailSQL,
  TenantRemoteIdSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-readmodel-models";
import { describe, it, expect } from "vitest";

import { splitTenantIntoObjectsSQL } from "../../src/tenant/splitters.js";

describe("Tenant splitters", () => {
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
      const tenantDeclaredAttribute: DeclaredTenantAttribute = {
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
      const tenantCertifiedDiscreteAttribute: CertifiedDiscreteTenantAttribute =
        {
          ...getMockCertifiedDiscreteTenantAttribute(),
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
          discreteValue: 42,
        };
      const tenantRemoteId: TenantRemoteId = {
        ...getMockTenantRemoteId(),
        origin: "ISTAT",
        value: "istat-code",
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
          tenantCertifiedDiscreteAttribute,
          tenantDeclaredAttribute,
          tenantVerifiedAttribute,
        ],
        features: [
          tenantFeatureCertifier,
          tenantFeatureDelegatedConsumer,
          tenantFeatureDelegatedProducer,
        ],
        remoteIds: [tenantRemoteId],
      };

      const {
        tenantSQL,
        mailsSQL,
        certifiedAttributesSQL,
        declaredAttributesSQL,
        verifiedAttributesSQL,
        verifiedAttributeVerifiersSQL,
        verifiedAttributeRevokersSQL,
        featuresSQL,
        certifiedDiscreteAttributesSQL,
        remoteIdsSQL,
      } = splitTenantIntoObjectsSQL(tenant, 1);

      const expectedTenantSQL: TenantSQL = {
        id: tenant.id,
        metadataVersion: 1,
        kind: tenantKind.PA,
        selfcareId,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt!.toISOString(),
        name: tenant.name,
        onboardedAt: tenant.onboardedAt!.toISOString(),
        subUnitType: tenantUnitType.AOO,
        externalIdOrigin: externalId.origin,
        externalIdValue: externalId.value,
        selfcareInstitutionType: tenant.selfcareInstitutionType || null,
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
        assignmentTimestamp:
          tenantCertifiedAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp:
          tenantCertifiedAttribute.revocationTimestamp!.toISOString(),
      };
      const expectedTenantCertifiedDiscreteAttributeSQL: TenantCertifiedDiscreteAttributeSQL =
        {
          metadataVersion: 1,
          tenantId: tenant.id,
          attributeId: tenantCertifiedDiscreteAttribute.id,
          assignmentTimestamp:
            tenantCertifiedDiscreteAttribute.assignmentTimestamp.toISOString(),
          revocationTimestamp:
            tenantCertifiedDiscreteAttribute.revocationTimestamp!.toISOString(),
          discreteValue: tenantCertifiedDiscreteAttribute.discreteValue,
        };

      const expectedTenantDeclaredAttributeSQL: TenantDeclaredAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantDeclaredAttribute.id,
        assignmentTimestamp:
          tenantDeclaredAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp:
          tenantDeclaredAttribute.revocationTimestamp!.toISOString(),
        delegationId,
      };

      const expectedTenantVerifiedAttributeSQL: TenantVerifiedAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantVerifiedAttribute.id,
        assignmentTimestamp:
          tenantVerifiedAttribute.assignmentTimestamp.toISOString(),
      };

      const expectedTenantVerifierSQL: TenantVerifiedAttributeVerifierSQL = {
        tenantVerifierId: tenantVerifier.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantVerifier.verificationDate.toISOString(),
        expirationDate: tenantVerifier.expirationDate!.toISOString(),
        extensionDate: tenantVerifier.extensionDate!.toISOString(),
      };

      const expectedTenantRevokerSQL: TenantVerifiedAttributeRevokerSQL = {
        tenantRevokerId: tenantRevoker.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantRevoker.verificationDate.toISOString(),
        expirationDate: tenantRevoker.expirationDate!.toISOString(),
        extensionDate: tenantRevoker.extensionDate!.toISOString(),
        revocationDate: tenantRevoker.revocationDate.toISOString(),
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
        availabilityTimestamp:
          tenantFeatureDelegatedConsumer.availabilityTimestamp.toISOString(),
      };
      const expectedTenantFeatureDelegatedProducerSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.delegatedProducer,
        certifierId: null,
        availabilityTimestamp:
          tenantFeatureDelegatedProducer.availabilityTimestamp.toISOString(),
      };
      const expectedTenantRemoteIdSQL: TenantRemoteIdSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        origin: tenantRemoteId.origin,
        value: tenantRemoteId.value,
        assignmentTimestamp: tenantRemoteId.assignmentTimestamp.toISOString(),
      };

      expect(tenantSQL).toStrictEqual(expectedTenantSQL);
      expect(mailsSQL).toStrictEqual([expectedTenantMailSQL]);
      expect(certifiedAttributesSQL).toStrictEqual([
        expectedTenantCertifiedAttributeSQL,
      ]);
      expect(certifiedDiscreteAttributesSQL).toStrictEqual([
        expectedTenantCertifiedDiscreteAttributeSQL,
      ]);
      expect(declaredAttributesSQL).toStrictEqual([
        expectedTenantDeclaredAttributeSQL,
      ]);
      expect(verifiedAttributesSQL).toStrictEqual([
        expectedTenantVerifiedAttributeSQL,
      ]);
      expect(verifiedAttributeVerifiersSQL).toStrictEqual([
        expectedTenantVerifierSQL,
      ]);
      expect(verifiedAttributeRevokersSQL).toStrictEqual([
        expectedTenantRevokerSQL,
      ]);
      expect(featuresSQL).toStrictEqual(
        expect.arrayContaining([
          expectedTenantFeatureCertifierSQL,
          expectedTenantFeatureDelegatedConsumerSQL,
          expectedTenantFeatureDelegatedProducerSQL,
        ])
      );
      expect(remoteIdsSQL).toStrictEqual([expectedTenantRemoteIdSQL]);
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
      const tenantDeclaredAttribute: DeclaredTenantAttribute = {
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
          tenantDeclaredAttribute,
          tenantVerifiedAttribute,
        ],
        features: [
          tenantFeatureCertifier,
          tenantFeatureDelegatedConsumer,
          tenantFeatureDelegatedProducer,
        ],
      };

      const {
        tenantSQL,
        mailsSQL,
        certifiedAttributesSQL,
        declaredAttributesSQL,
        verifiedAttributesSQL,
        verifiedAttributeVerifiersSQL,
        verifiedAttributeRevokersSQL,
        featuresSQL,
      } = splitTenantIntoObjectsSQL(tenant, 1);

      const expectedTenantSQL: TenantSQL = {
        id: tenant.id,
        metadataVersion: 1,
        kind: null,
        selfcareId,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: null,
        name: tenant.name,
        onboardedAt: tenant.onboardedAt!.toISOString(),
        subUnitType: null,
        externalIdOrigin: externalId.origin,
        externalIdValue: externalId.value,
        selfcareInstitutionType: tenant.selfcareInstitutionType || null,
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
        assignmentTimestamp:
          tenantCertifiedAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp: null,
      };

      const expectedTenantDeclaredAttributeSQL: TenantDeclaredAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantDeclaredAttribute.id,
        assignmentTimestamp:
          tenantDeclaredAttribute.assignmentTimestamp.toISOString(),
        revocationTimestamp: null,
        delegationId,
      };

      const expectedTenantVerifiedAttributeSQL: TenantVerifiedAttributeSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        attributeId: tenantVerifiedAttribute.id,
        assignmentTimestamp:
          tenantVerifiedAttribute.assignmentTimestamp.toISOString(),
      };

      const expectedTenantVerifierSQL: TenantVerifiedAttributeVerifierSQL = {
        tenantVerifierId: tenantVerifier.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantVerifier.verificationDate.toISOString(),
        expirationDate: null,
        extensionDate: null,
      };

      const expectedTenantRevokerSQL: TenantVerifiedAttributeRevokerSQL = {
        tenantRevokerId: tenantRevoker.id,
        tenantId: tenant.id,
        metadataVersion: 1,
        delegationId,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantRevoker.verificationDate.toISOString(),
        expirationDate: null,
        extensionDate: null,
        revocationDate: tenantRevoker.revocationDate.toISOString(),
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
        availabilityTimestamp:
          tenantFeatureDelegatedConsumer.availabilityTimestamp.toISOString(),
      };
      const expectedTenantFeatureDelegatedProducerSQL: TenantFeatureSQL = {
        tenantId: tenant.id,
        metadataVersion: 1,
        kind: tenantFeatureType.delegatedProducer,
        certifierId: null,
        availabilityTimestamp:
          tenantFeatureDelegatedProducer.availabilityTimestamp.toISOString(),
      };

      expect(tenantSQL).toStrictEqual(expectedTenantSQL);
      expect(mailsSQL).toStrictEqual([expectedTenantMailSQL]);
      expect(certifiedAttributesSQL).toStrictEqual([
        expectedTenantCertifiedAttributeSQL,
      ]);
      expect(declaredAttributesSQL).toStrictEqual([
        expectedTenantDeclaredAttributeSQL,
      ]);
      expect(verifiedAttributesSQL).toStrictEqual([
        expectedTenantVerifiedAttributeSQL,
      ]);
      expect(verifiedAttributeVerifiersSQL).toStrictEqual([
        expectedTenantVerifierSQL,
      ]);
      expect(verifiedAttributeRevokersSQL).toStrictEqual([
        expectedTenantRevokerSQL,
      ]);
      expect(featuresSQL).toStrictEqual(
        expect.arrayContaining([
          expectedTenantFeatureCertifierSQL,
          expectedTenantFeatureDelegatedConsumerSQL,
          expectedTenantFeatureDelegatedProducerSQL,
        ])
      );
    });
  });
});
