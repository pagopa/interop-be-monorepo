import {
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  TenantEventEnvelopeV2,
  Tenant,
  TenantOnboardedV2,
  TenantOnboardDetailsUpdatedV2,
  TenantCertifiedAttributeAssignedV2,
  TenantCertifiedAttributeRevokedV2,
  TenantDeclaredAttributeAssignedV2,
  TenantDeclaredAttributeRevokedV2,
  TenantVerifiedAttributeAssignedV2,
  TenantVerifiedAttributeRevokedV2,
  TenantVerifiedAttributeExpirationUpdatedV2,
  TenantVerifiedAttributeExtensionUpdatedV2,
  TenantMailAddedV2,
  TenantMailDeletedV2,
  TenantKindUpdatedV2,
  generateId,
  toTenantV2,
  TenantKindV2,
  tenantKind,
  MaintenanceTenantDeletedV2,
  tenantUnitType,
  MaintenanceTenantUpdatedV2,
  tenantFeatureType,
  VerifiedTenantAttribute,
  tenantAttributeType,
  CertifiedTenantAttribute,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  getCustomMockCertifiedTenantAttribute,
  getCustomMockDeclaredTenantAttribute,
  tenantReadModelService,
  tenantWriterService,
} from "./utils.js";

describe("Tenant Events V2", async () => {
  const mockTenant = getMockTenant();
  const mockMessage: Omit<TenantEventEnvelopeV2, "type" | "data"> = {
    event_version: 2,
    stream_id: mockTenant.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
  };

  it("TenantOnboarded", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      onboardedAt: new Date(),
    };

    const payload: TenantOnboardedV2 = {
      tenant: toTenantV2(tenant),
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantOnboarded",
      data: payload,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(tenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 1,
    });
  });
  it("TenantOnboardDetailsUpdated", async () => {
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const updatedTenant: Tenant = {
      ...mockTenant,
      selfcareId: generateId(),
      updatedAt: new Date(),
    };
    const payload: TenantOnboardDetailsUpdatedV2 = {
      tenant: toTenantV2(updatedTenant),
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantOnboardDetailsUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantCertifiedAttributeAssigned", async () => {
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const certifiedAttribute = getCustomMockCertifiedTenantAttribute();

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [certifiedAttribute],
    };
    const payload: TenantCertifiedAttributeAssignedV2 = {
      tenant: toTenantV2(updatedTenant),
      attributeId: certifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantCertifiedAttributeAssigned",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantCertifiedAttributeRevoked", async () => {
    const certifiedAttribute: CertifiedTenantAttribute = {
      type: tenantAttributeType.CERTIFIED,
      id: generateId(),
      assignmentTimestamp: new Date(),
    };
    const tenantWithCertifiedAttribute: Tenant = {
      ...mockTenant,
      attributes: [certifiedAttribute],
    };
    await tenantWriterService.upsertTenant(tenantWithCertifiedAttribute, 1);

    const revokedCertifiedAttribute: CertifiedTenantAttribute = {
      ...certifiedAttribute,
      revocationTimestamp: new Date(),
    };

    const tenantWithRevokedCertifiedAttribute: Tenant = {
      ...tenantWithCertifiedAttribute,
      attributes: [revokedCertifiedAttribute],
    };

    const payload: TenantCertifiedAttributeRevokedV2 = {
      tenant: toTenantV2(tenantWithRevokedCertifiedAttribute),
      attributeId: certifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantCertifiedAttributeRevoked",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(
      tenantWithRevokedCertifiedAttribute
    );
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantDeclaredAttributeAssigned", async () => {
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const declaredAttribute = getCustomMockDeclaredTenantAttribute();

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [declaredAttribute],
    };
    const payload: TenantDeclaredAttributeAssignedV2 = {
      tenant: toTenantV2(updatedTenant),
      attributeId: declaredAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantDeclaredAttributeAssigned",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantDeclaredAttributeRevoked", async () => {
    const declaredAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [declaredAttribute],
    };
    await tenantWriterService.upsertTenant(updatedTenant, 1);

    const payload: TenantDeclaredAttributeRevokedV2 = {
      tenant: toTenantV2(mockTenant),
      attributeId: declaredAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantDeclaredAttributeRevoked",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data.attributes).toHaveLength(0);
  });
  it("TenantVerifiedAttributeAssigned", async () => {
    const verifier: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: tenantFeatureType.persistentCertifier,
          certifierId: "certifier-id",
        },
      ],
    };

    await tenantWriterService.upsertTenant(verifier, 1);

    await tenantWriterService.upsertTenant(mockTenant, 1);

    const verifiedAttribute: VerifiedTenantAttribute = {
      id: generateId(),
      assignmentTimestamp: new Date(),
      verifiedBy: [{ id: verifier.id, verificationDate: new Date() }],
      revokedBy: [],
      type: tenantAttributeType.VERIFIED,
    };

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };
    const payload: TenantVerifiedAttributeAssignedV2 = {
      tenant: toTenantV2(updatedTenant),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeAssigned",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantVerifiedAttributeRevoked", async () => {
    const revoker: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: tenantFeatureType.persistentCertifier,
          certifierId: "certifier-id",
        },
      ],
    };

    const verifiedAttribute: VerifiedTenantAttribute = {
      id: generateId(),
      assignmentTimestamp: new Date(),
      verifiedBy: [{ id: revoker.id, verificationDate: new Date() }],
      revokedBy: [],
      type: tenantAttributeType.VERIFIED,
    };

    await tenantWriterService.upsertTenant(revoker, 1);

    const tenantWithVerifiedAttribute: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };

    await tenantWriterService.upsertTenant(tenantWithVerifiedAttribute, 1);

    const revokedAttribute: VerifiedTenantAttribute = {
      ...verifiedAttribute,
      verifiedBy: [],
      revokedBy: [
        {
          id: revoker.id,
          verificationDate: new Date(),
          revocationDate: new Date(),
        },
      ],
      type: tenantAttributeType.VERIFIED,
    };

    const tenantWithRevokedVerifiedAttribute: Tenant = {
      ...tenantWithVerifiedAttribute,
      attributes: [revokedAttribute],
    };

    const payload: TenantVerifiedAttributeRevokedV2 = {
      tenant: toTenantV2(tenantWithRevokedVerifiedAttribute),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeRevoked",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(
      tenantWithRevokedVerifiedAttribute
    );
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantVerifiedAttributeExpirationUpdated", async () => {
    const verifier: Tenant = getMockTenant();

    const verifiedAttribute: VerifiedTenantAttribute = {
      id: generateId(),
      assignmentTimestamp: new Date(),
      verifiedBy: [{ id: verifier.id, verificationDate: new Date() }],
      revokedBy: [],
      type: tenantAttributeType.VERIFIED,
    };

    await tenantWriterService.upsertTenant(verifier, 1);

    const tenantWithVerifiedAttribute: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };

    await tenantWriterService.upsertTenant(tenantWithVerifiedAttribute, 1);

    const attributeWithUpdatedExpiration: VerifiedTenantAttribute = {
      ...verifiedAttribute,
      verifiedBy: [
        {
          id: verifier.id,
          verificationDate: new Date(),
          expirationDate: new Date(),
        },
      ],
      type: tenantAttributeType.VERIFIED,
    };

    const tenantWithUpdatedVerifiedAttribute: Tenant = {
      ...tenantWithVerifiedAttribute,
      attributes: [attributeWithUpdatedExpiration],
    };

    const payload: TenantVerifiedAttributeExpirationUpdatedV2 = {
      tenant: toTenantV2(tenantWithUpdatedVerifiedAttribute),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeExpirationUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(
      tenantWithUpdatedVerifiedAttribute
    );
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantVerifiedAttributeExtensionUpdated", async () => {
    const verifier: Tenant = getMockTenant();

    const verifiedAttribute: VerifiedTenantAttribute = {
      id: generateId(),
      assignmentTimestamp: new Date(),
      verifiedBy: [{ id: verifier.id, verificationDate: new Date() }],
      revokedBy: [],
      type: tenantAttributeType.VERIFIED,
    };

    await tenantWriterService.upsertTenant(verifier, 1);

    const tenantWithVerifiedAttribute: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };

    await tenantWriterService.upsertTenant(tenantWithVerifiedAttribute, 1);

    const attributeWithUpdatedExtensionDate: VerifiedTenantAttribute = {
      ...verifiedAttribute,
      verifiedBy: [
        {
          id: verifier.id,
          verificationDate: new Date(),
          expirationDate: new Date(),
        },
      ],
      type: tenantAttributeType.VERIFIED,
    };

    const tenantWithExtendedVerifiedAttribute: Tenant = {
      ...tenantWithVerifiedAttribute,
      attributes: [attributeWithUpdatedExtensionDate],
    };

    const payload: TenantVerifiedAttributeExtensionUpdatedV2 = {
      tenant: toTenantV2(tenantWithExtendedVerifiedAttribute),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeExpirationUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(
      tenantWithExtendedVerifiedAttribute
    );
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantMailAdded", async () => {
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const mail = { ...getMockTenantMail() };

    const updatedTenant: Tenant = {
      ...mockTenant,
      mails: [mail],
    };

    const payload: TenantMailAddedV2 = {
      tenant: toTenantV2(updatedTenant),
      mailId: mail.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantMailAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantMailDeleted", async () => {
    const mail = getMockTenantMail();

    const tenant: Tenant = {
      ...mockTenant,
      mails: [mail],
    };

    await tenantWriterService.upsertTenant(tenant, 1);

    const updatedTenant: Tenant = {
      ...mockTenant,
      mails: [],
    };

    const payload: TenantMailDeletedV2 = {
      tenant: toTenantV2(updatedTenant),
      mailId: mail.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantMailDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("TenantKindUpdated", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.GSP,
    };
    await tenantWriterService.upsertTenant(tenant, 1);

    const updatedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
    };

    const payload: TenantKindUpdatedV2 = {
      tenant: toTenantV2(updatedTenant),
      oldKind: TenantKindV2.GSP,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantKindUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("MaintenanceTenantDeleted", async () => {
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const payload: MaintenanceTenantDeletedV2 = {
      tenantId: mockTenant.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "MaintenanceTenantDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant).toBeUndefined();
  });
  it("MaintenanceTenantUpdated", async () => {
    const mail = getMockTenantMail();

    const tenant: Tenant = {
      ...mockTenant,
      selfcareId: crypto.randomUUID(),
      externalId: {
        origin: "o1",
        value: "v1",
      },
      mails: [mail],
      name: "old_name",
      kind: tenantKind.GSP,
      onboardedAt: new Date(),
      subUnitType: tenantUnitType.AOO,
    };

    await tenantWriterService.upsertTenant(tenant, 1);

    const updatedTenant: Tenant = {
      ...mockTenant,
      selfcareId: crypto.randomUUID(),
      externalId: {
        origin: "o2",
        value: "v2",
      },
      mails: [getMockTenantMail()],
      name: "new_name",
      kind: tenantKind.PA,
      onboardedAt: new Date(),
      subUnitType: tenantUnitType.UO,
    };

    const payload: MaintenanceTenantUpdatedV2 = {
      tenant: toTenantV2(updatedTenant),
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "MaintenanceTenantUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({
      version: 2,
    });
  });
});
