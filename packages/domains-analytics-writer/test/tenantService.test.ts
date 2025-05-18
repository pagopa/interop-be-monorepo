/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateId,
  TenantCreatedV1,
  TenantEventEnvelope,
  TenantFeatureCertifier,
  tenantFeatureType,
  TenantRevoker,
  TenantVerifier,
} from "pagopa-interop-models";
import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import { handleTenantMessageV1 } from "../src/handlers/tenant/consumerServiceV1.js";
import { TenantDbTable } from "../src/model/db/index.js";
import {
  dbContext,
  getManyFromDb,
  getOneFromDb,
  resetTargetTables,
  tenantTables,
} from "./utils.js";
import { toTenantV1 } from "./utilsTenantConverterV1.js";
import { getMockVerifiedBy, getMockRevokedBy } from "./utilsTenant.js";

describe("Tenant messages consumers - handleTenantMessageV1", () => {
  const mockTenantMail = getMockTenantMail();
  const mockTenantFeatureCertifier: TenantFeatureCertifier = {
    type: tenantFeatureType.persistentCertifier,
    certifierId: generateId(),
  };
  const mockTenantVerifier = getMockTenant();
  const mockTenantRevoker = getMockTenant();
  const mockVerifiedBy: TenantVerifier = {
    ...getMockVerifiedBy(),
    id: mockTenantVerifier.id,
  };
  const mockRevokedBy: TenantRevoker = {
    ...getMockRevokedBy(),
    id: mockTenantRevoker.id,
  };

  const mockDeclaredTenantAttribute = getMockDeclaredTenantAttribute();
  const mockCertifiedTenantAttribute = getMockCertifiedTenantAttribute();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  mockVerifiedTenantAttribute.verifiedBy = [{ ...mockVerifiedBy }];
  mockVerifiedTenantAttribute.revokedBy = [{ ...mockRevokedBy }];

  beforeEach(async () => {
    await resetTargetTables(tenantTables);
  });

  it("TenantCreated: inserts tenant with mails, attributes, features", async () => {
    const mockTenant = getMockTenant();
    mockTenant.mails = [mockTenantMail];
    mockTenant.attributes = [
      mockDeclaredTenantAttribute,
      mockVerifiedTenantAttribute,
      mockCertifiedTenantAttribute,
    ];
    mockTenant.features = [mockTenantFeatureCertifier];

    const payload: TenantCreatedV1 = {
      tenant: toTenantV1(mockTenant),
    };

    const msgTenantVerifier: TenantEventEnvelope = {
      sequence_num: 1,
      stream_id: mockTenantVerifier.id,
      version: 1,
      type: "TenantCreated",
      event_version: 1,
      data: { tenant: toTenantV1(mockTenantVerifier) },
      log_date: new Date(),
    };

    const msgTenantRevoker: TenantEventEnvelope = {
      sequence_num: 1,
      stream_id: mockTenantRevoker.id,
      version: 1,
      type: "TenantCreated",
      event_version: 1,
      data: { tenant: toTenantV1(mockTenantRevoker) },
      log_date: new Date(),
    };

    const msgTenant: TenantEventEnvelope = {
      sequence_num: 1,
      stream_id: mockTenant.id,
      version: 1,
      type: "TenantCreated",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleTenantMessageV1(
      [msgTenantVerifier, msgTenantRevoker, msgTenant],
      dbContext
    );

    const storedTenant = await getOneFromDb(dbContext, TenantDbTable.tenant, {
      id: mockTenant.id,
    });

    expect(storedTenant.id).toBe(mockTenant.id);
    expect(storedTenant.onboardedAt).toStrictEqual(mockTenant.onboardedAt);

    const storedTenantMails = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_mail,
      { id: mockTenantMail.id }
    );
    expect(storedTenantMails.length).toBe(1);
    expect(storedTenantMails[0].id).toBe(mockTenantMail.id);

    const storedDeclaredTenantAttributes = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_declared_attribute,
      { attributeId: mockDeclaredTenantAttribute.id }
    );
    expect(storedDeclaredTenantAttributes.length).toBe(1);
    expect(storedDeclaredTenantAttributes[0].attributeId).toBe(
      mockDeclaredTenantAttribute.id
    );

    const storedVerifiedTenantAttributes = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_verified_attribute,
      { attributeId: mockVerifiedTenantAttribute.id }
    );
    expect(storedVerifiedTenantAttributes.length).toBe(1);
    expect(storedVerifiedTenantAttributes[0].attributeId).toBe(
      mockVerifiedTenantAttribute.id
    );

    const storedCertifiedTenantAttributes = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_certified_attribute,
      { attributeId: mockCertifiedTenantAttribute.id }
    );
    expect(storedCertifiedTenantAttributes.length).toBe(1);
    expect(storedCertifiedTenantAttributes[0].attributeId).toBe(
      mockCertifiedTenantAttribute.id
    );

    const storedTenantFeatures = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_feature,
      { tenantId: mockTenant.id, kind: mockTenantFeatureCertifier.type }
    );

    expect(storedTenantFeatures.length).toBe(1);
    expect(storedTenantFeatures[0].certifierId).toBe(
      mockTenantFeatureCertifier.certifierId
    );
  });
});
