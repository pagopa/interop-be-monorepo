/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateId,
  TenantCreatedV1,
  TenantMailDeletedV1,
  TenantEventEnvelope,
  TenantMailDeletedV2,
  TenantDelegatedProducerFeatureRemovedV2,
  TenantDelegatedConsumerFeatureRemovedV2,
  SelfcareMappingCreatedV1,
  TenantFeatureCertifier,
  tenantFeatureType,
  TenantRevoker,
  TenantVerifier,
  toTenantV2,
  TenantEventEnvelopeV2,
  MaintenanceTenantUpdatedV2,
  tenantKind,
  TenantDeletedV1,
  TenantEventEnvelopeV1,
  TenantMailAddedV1,
  TenantOnboardedV2,
} from "pagopa-interop-models";
import {
  getMockTenant,
  getMockTenantMail,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockVerifiedTenantAttribute,
  toTenantV1,
} from "pagopa-interop-commons-test";
import { handleTenantMessageV1 } from "../src/handlers/tenant/consumerServiceV1.js";
import { handleTenantMessageV2 } from "../src/handlers/tenant/consumerServiceV2.js";
import { TenantDbTable } from "../src/model/db/index.js";
import {
  dbContext,
  getManyFromDb,
  getOneFromDb,
  resetTargetTables,
  tenantTables,
} from "./utils.js";
import { getMockVerifiedBy, getMockRevokedBy } from "./utilsTenant.js";

describe("Tenant messages consumers - handleTenantMessageV1", () => {
  beforeEach(async () => {
    await resetTargetTables(tenantTables);
  });

  it("TenantCreated: inserts tenant with mails, attributes, features", async () => {
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

    expect(storedTenant?.id).toBe(mockTenant.id);
    expect(storedTenant?.onboardedAt).toStrictEqual(mockTenant.createdAt);

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

  it("TenantDeleted: cascades logical deletion to all related tables", async () => {
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

    const msgTenantDeleted: TenantEventEnvelope = {
      sequence_num: 2,
      stream_id: mockTenant.id,
      version: 2,
      type: "TenantDeleted",
      event_version: 1,
      data: {
        tenantId: mockTenant.id,
      } as TenantDeletedV1,
      log_date: new Date(),
    };

    await handleTenantMessageV1(
      [msgTenantVerifier, msgTenantRevoker, msgTenant, msgTenantDeleted],
      dbContext
    );

    const tenantId = mockTenant.id;

    const storedTenant = await getOneFromDb(dbContext, TenantDbTable.tenant, {
      id: tenantId,
    });
    expect(storedTenant?.deleted).toBe(true);

    const checks = [
      { table: TenantDbTable.tenant_mail, where: { tenantId } },
      { table: TenantDbTable.tenant_certified_attribute, where: { tenantId } },
      { table: TenantDbTable.tenant_declared_attribute, where: { tenantId } },
      { table: TenantDbTable.tenant_verified_attribute, where: { tenantId } },
      {
        table: TenantDbTable.tenant_verified_attribute_verifier,
        where: { tenantId },
      },
      {
        table: TenantDbTable.tenant_verified_attribute_revoker,
        where: { tenantId },
      },
      { table: TenantDbTable.tenant_feature, where: { tenantId } },
    ];

    for (const { table, where } of checks) {
      const rows = await getManyFromDb(dbContext, table, where);
      rows.forEach((r) => expect(r.deleted).toBe(true));
    }
  });

  it("TenantMailDeleted: delete tenant mail", async () => {
    const mockTenant = getMockTenant();
    const mockTenantMail = getMockTenantMail();
    mockTenant.mails = [mockTenantMail];

    await handleTenantMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mockTenant.id,
          version: 1,
          type: "TenantCreated",
          event_version: 1,
          data: { tenant: toTenantV1(mockTenant) },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 2,
          type: "TenantMailDeleted",
          event_version: 1,
          data: {
            mailId: mockTenantMail.id,
            tenantId: mockTenant.id,
          } as TenantMailDeletedV1,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const mail = await getOneFromDb(dbContext, TenantDbTable.tenant_mail, {
      id: mockTenantMail.id,
    });

    expect(mail).toBeUndefined();
  });

  it("SelfcareMappingCreated: adds selfcare id mapping with metadata_version 3", async () => {
    const mockTenant = getMockTenant();
    const selfcareId = generateId();

    await handleTenantMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mockTenant.id,
          version: 1,
          type: "TenantCreated",
          event_version: 1,
          data: { tenant: toTenantV1(mockTenant) },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 2,
          type: "SelfcareMappingCreated",
          event_version: 1,
          data: {
            tenantId: mockTenant.id,
            selfcareId,
          } as SelfcareMappingCreatedV1,
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 3,
          type: "SelfcareMappingCreated",
          event_version: 1,
          data: {
            tenantId: mockTenant.id,
            selfcareId,
          } as SelfcareMappingCreatedV1,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const mapping = await getOneFromDb(dbContext, TenantDbTable.tenant, {
      id: mockTenant.id,
    });
    expect(mapping?.selfcareId).toBe(selfcareId);
    expect(mapping?.metadataVersion).toBe(3);
  });

  it("TenantMailAdded: should throw error when tenant is missing", async () => {
    const msg: TenantEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: "some-id",
      version: 1,
      type: "TenantMailAdded",
      event_version: 1,
      data: {} as unknown as TenantMailAddedV1,
      log_date: new Date(),
    };

    await expect(() => handleTenantMessageV1([msg], dbContext)).rejects.toThrow(
      "Tenant can't be missing in the event message"
    );
  });

  it("TenantCreated: should skip update when incoming metadata_version is lower or equal (V1)", async () => {
    const tenant = getMockTenant();
    const tenantV1 = toTenantV1({ ...tenant, name: "V1" });
    const tenantV3 = toTenantV1({ ...tenant, name: "V3" });
    const tenantV2 = toTenantV1({ ...tenant, name: "V2" });

    await handleTenantMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: tenant.id,
          version: 1,
          type: "TenantCreated",
          event_version: 1,
          data: { tenant: tenantV1 },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    await handleTenantMessageV1(
      [
        {
          sequence_num: 2,
          stream_id: tenant.id,
          version: 3,
          type: "TenantUpdated",
          event_version: 1,
          data: { tenant: tenantV3 },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    await handleTenantMessageV1(
      [
        {
          sequence_num: 3,
          stream_id: tenant.id,
          version: 2,
          type: "TenantUpdated",
          event_version: 1,
          data: { tenant: tenantV2 },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const stored = await getOneFromDb(dbContext, TenantDbTable.tenant, {
      id: tenant.id,
    });

    expect(stored?.name).toBe("V3");
    expect(stored?.metadataVersion).toBe(3);
  });
});

describe("Tenant messages consumers - handleTenantMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(tenantTables);
  });

  it("MaintenanceTenantUpdated: updates tenant fields", async () => {
    const originalTenant = getMockTenant();
    originalTenant.name = "Old Name";
    originalTenant.kind = "PA";

    const updatedTenant = {
      ...originalTenant,
      name: "Updated Name",
      kind: tenantKind.GSP,
    };

    await handleTenantMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: originalTenant.id,
          version: 1,
          type: "TenantOnboarded",
          event_version: 2,
          data: { tenant: toTenantV2(originalTenant) },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const updateMsg: TenantEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: updatedTenant.id,
      version: 2,
      type: "MaintenanceTenantUpdated",
      event_version: 2,
      data: {
        tenant: toTenantV2(updatedTenant),
      } as MaintenanceTenantUpdatedV2,
      log_date: new Date(),
    };

    await handleTenantMessageV2([updateMsg], dbContext);

    const stored = await getOneFromDb(dbContext, TenantDbTable.tenant, {
      id: updatedTenant.id,
    });

    expect(stored).toBeDefined();
    expect(stored?.name).toBe("Updated Name");
    expect(stored?.kind).toBe("GSP");
    expect(stored?.metadataVersion).toBe(2);
  });

  it("TenantMailAdded: should delete first mail, update second mail, add a third mail", async () => {
    const mockTenant = getMockTenant();
    const mockTenantMailToDelete = getMockTenantMail();
    const mockTenantMailToUpdate = getMockTenantMail();
    const mockTenantMailNew = getMockTenantMail();

    const tenantMailDeleted = {
      ...mockTenant,
      mails: [
        {
          ...mockTenantMailToUpdate,
          description: "Updated mail description",
        },
        mockTenantMailNew,
      ],
    };

    const tenantOnboarded = {
      ...mockTenant,
      mails: [mockTenantMailToDelete, mockTenantMailToUpdate],
    };

    await handleTenantMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mockTenant.id,
          version: 1,
          type: "TenantOnboarded",
          event_version: 2,
          data: {
            tenant: toTenantV2(tenantOnboarded),
          },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 2,
          type: "TenantMailDeleted",
          event_version: 2,
          data: {
            tenant: toTenantV2(tenantMailDeleted),
          } as TenantMailDeletedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const mails = await getManyFromDb(dbContext, TenantDbTable.tenant_mail, {
      tenantId: mockTenant.id,
    });

    const tenantMailToBeDeleted = mails.find(
      (m) => m.id === mockTenantMailToDelete.id
    );
    expect(tenantMailToBeDeleted).toBeUndefined();

    const tenantMailToBeUpdate = mails.find(
      (m) => m.id === mockTenantMailToUpdate.id
    );
    expect(tenantMailToBeUpdate).toBeDefined();
    expect(tenantMailToBeUpdate?.description).toBe("Updated mail description");

    const tenantMailNew = mails.find((m) => m.id === mockTenantMailNew.id);
    expect(tenantMailNew).toBeDefined();
  });

  it("TenantMailDeleted: should remove all existing tenant mails when handling with an empty mails array", async () => {
    const mockTenant = getMockTenant();
    const mockTenantMailToDelete = getMockTenantMail();

    const tenantMailDeleted = {
      ...mockTenant,
      mails: [],
    };

    const tenantOnboarded = {
      ...mockTenant,
      mails: [mockTenantMailToDelete],
    };

    await handleTenantMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mockTenant.id,
          version: 1,
          type: "TenantOnboarded",
          event_version: 2,
          data: {
            tenant: toTenantV2(tenantOnboarded),
          },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 2,
          type: "TenantMailDeleted",
          event_version: 2,
          data: {
            tenant: toTenantV2(tenantMailDeleted),
          } as TenantMailDeletedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const mails = await getManyFromDb(dbContext, TenantDbTable.tenant_mail, {
      tenantId: mockTenant.id,
    });

    expect(mails).toHaveLength(0);
  });

  it("TenantDelegatedProducerFeatureRemoved: should deletes feature", async () => {
    const mockTenant = getMockTenant();

    await handleTenantMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mockTenant.id,
          version: 1,
          type: "TenantDelegatedProducerFeatureAdded",
          event_version: 2,
          data: { tenant: toTenantV2(mockTenant) },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 2,
          type: "TenantDelegatedProducerFeatureRemoved",
          event_version: 2,
          data: {
            tenant: toTenantV2(mockTenant),
          } as TenantDelegatedProducerFeatureRemovedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const features = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_feature,
      {
        tenantId: mockTenant.id,
      }
    );
    features.forEach((f) => expect(f.deleted).toBe(true));
  });

  it("TenantDelegatedConsumerFeatureRemoved: should deletes consumer feature", async () => {
    const mockTenant = getMockTenant();

    await handleTenantMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mockTenant.id,
          version: 1,
          type: "TenantDelegatedConsumerFeatureAdded",
          event_version: 2,
          data: { tenant: toTenantV2(mockTenant) },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mockTenant.id,
          version: 2,
          type: "TenantDelegatedConsumerFeatureRemoved",
          event_version: 2,
          data: {
            tenant: toTenantV2(mockTenant),
          } as TenantDelegatedConsumerFeatureRemovedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const features = await getManyFromDb(
      dbContext,
      TenantDbTable.tenant_feature,
      {
        tenantId: mockTenant.id,
      }
    );
    features.forEach((f) => expect(f.deleted).toBe(true));
  });

  it("TenantOnboarded: should throw error when tenant is missing", async () => {
    const msg: TenantEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: "some-id",
      version: 1,
      type: "TenantOnboarded",
      event_version: 2,
      data: {} as unknown as TenantOnboardedV2,
      log_date: new Date(),
    };

    await expect(() => handleTenantMessageV2([msg], dbContext)).rejects.toThrow(
      "Tenant can't be missing in the event message"
    );
  });

  it("TenantDelegatedConsumerFeatureRemoved: should throw error when tenant is missing", async () => {
    const msg: TenantEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: "some-id",
      version: 1,
      type: "TenantDelegatedConsumerFeatureRemoved",
      event_version: 2,
      data: {} as TenantOnboardedV2,
      log_date: new Date(),
    };

    await expect(() => handleTenantMessageV2([msg], dbContext)).rejects.toThrow(
      "Tenant can't be missing in the event message"
    );
  });

  it("MaintenanceTenantUpdated: should skip update when incoming metadata_version is lower or equal (V2)", async () => {
    const tenant = getMockTenant();
    const tenantV1 = toTenantV2({ ...tenant, name: "V1" });
    const tenantV3 = toTenantV2({ ...tenant, name: "V3" });
    const tenantV2 = toTenantV2({ ...tenant, name: "V2" });

    await handleTenantMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: tenant.id,
          version: 1,
          type: "TenantOnboarded",
          event_version: 2,
          data: { tenant: tenantV1 },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    await handleTenantMessageV2(
      [
        {
          sequence_num: 2,
          stream_id: tenant.id,
          version: 3,
          type: "MaintenanceTenantUpdated",
          event_version: 2,
          data: { tenant: tenantV3 },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    await handleTenantMessageV2(
      [
        {
          sequence_num: 3,
          stream_id: tenant.id,
          version: 2,
          type: "MaintenanceTenantUpdated",
          event_version: 2,
          data: { tenant: tenantV2 },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const stored = await getOneFromDb(dbContext, TenantDbTable.tenant, {
      id: tenant.id,
    });

    expect(stored?.name).toBe("V3");
    expect(stored?.metadataVersion).toBe(3);
  });
});
