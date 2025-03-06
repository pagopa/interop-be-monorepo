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
import { describe, it, expect } from "vitest";
import { splitTenantIntoObjectsSQL } from "../src/tenant/splitters.js";
import { aggregateTenant } from "../src/tenant/aggregators.js";

describe("Tenant aggregators", () => {
  it("should convert Tenant SQL objects item into a Tenant", () => {
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
      mailsSQL,
      certifiedAttributesSQL,
      declaredAttributesSQL,
      verifiedAttributesSQL,
      verifiedAttributeVerifiersSQL,
      verifiedAttributeRevokersSQL,
      featuresSQL,
    } = splitTenantIntoObjectsSQL(tenant, 1);

    const aggregatedTenant = aggregateTenant({
      tenantSQL,
      mailsSQL,
      certifiedAttributesSQL,
      declaredAttributesSQL,
      verifiedAttributesSQL,
      verifiedAttributeVerifiersSQL,
      verifiedAttributeRevokersSQL,
      featuresSQL,
    });

    expect(aggregatedTenant).toMatchObject({
      data: tenant,
      metadata: { version: 1 },
    });
  });
  it("should convert null to undefined", () => {
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
      mailsSQL,
      certifiedAttributesSQL,
      declaredAttributesSQL,
      verifiedAttributesSQL,
      verifiedAttributeVerifiersSQL,
      verifiedAttributeRevokersSQL,
      featuresSQL,
    } = splitTenantIntoObjectsSQL(tenant, 1);

    const aggregatedTenant = aggregateTenant({
      tenantSQL,
      mailsSQL,
      certifiedAttributesSQL,
      declaredAttributesSQL,
      verifiedAttributesSQL,
      verifiedAttributeVerifiersSQL,
      verifiedAttributeRevokersSQL,
      featuresSQL,
    });

    expect(aggregatedTenant).toMatchObject({
      data: tenant,
      metadata: { version: 1 },
    });
  });
});
