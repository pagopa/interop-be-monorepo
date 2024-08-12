import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
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
  toReadModelTenant,
  TenantKindV2,
  tenantKind,
  MaintenanceTenantDeletedV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/tenantConsumerServiceV2.js";
import { tenants } from "./utils.js";

describe("Tenant Events V2", async () => {
  const mockTenant = getMockTenant();
  const mockMessage: TenantEventEnvelopeV2 = {
    event_version: 2,
    stream_id: mockTenant.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
    type: "TenantOnboarded",
    data: {},
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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(tenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 1,
    });
  });
  it("TenantOnboardDetailsUpdated", async () => {
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants, 1);

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantCertifiedAttributeAssigned", async () => {
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants, 1);

    const certifiedAttribute = {
      ...getMockCertifiedTenantAttribute(),
      assignmentTimestamp: new Date(),
      revocationTimestamp: undefined,
    };

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantCertifiedAttributeRevoked", async () => {
    const certifiedAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [certifiedAttribute],
    };
    await writeInReadmodel(toReadModelTenant(updatedTenant), tenants, 1);

    const payload: TenantCertifiedAttributeRevokedV2 = {
      tenant: toTenantV2(mockTenant),
      attributeId: certifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantCertifiedAttributeRevoked",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data.attributes).toHaveLength(0);
  });
  it("TenantDeclaredAttributeAssigned", async () => {
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants, 1);

    const declaredAttribute = {
      ...getMockDeclaredTenantAttribute(),
      assignmentTimestamp: new Date(),
      revocationTimestamp: undefined,
    };

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
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
    await writeInReadmodel(toReadModelTenant(updatedTenant), tenants, 1);

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data.attributes).toHaveLength(0);
  });
  it("TenantVerifiedAttributeAssigned", async () => {
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants, 1);

    const verifiedAttribute = {
      ...getMockVerifiedTenantAttribute(),
      assignmentTimestamp: new Date(),
      revocationTimestamp: undefined,
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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantVerifiedAttributeRevoked", async () => {
    const verifiedAttribute = {
      ...getMockVerifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };
    await writeInReadmodel(toReadModelTenant(updatedTenant), tenants, 1);

    const payload: TenantVerifiedAttributeRevokedV2 = {
      tenant: toTenantV2(mockTenant),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeRevoked",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data.attributes).toHaveLength(0);
  });
  it("TenantVerifiedAttributeExpirationUpdated", async () => {
    const verifiedAttribute = {
      ...getMockVerifiedTenantAttribute(),
    };

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };

    await writeInReadmodel(toReadModelTenant(tenant), tenants, 1);

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          ...verifiedAttribute,
          verifiedBy: [
            {
              ...verifiedAttribute.verifiedBy[0],
              expirationDate: new Date(),
            },
          ],
        },
      ],
    };

    const payload: TenantVerifiedAttributeExpirationUpdatedV2 = {
      tenant: toTenantV2(updatedTenant),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeExpirationUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantVerifiedAttributeExtensionUpdated", async () => {
    const verifiedAttribute = {
      ...getMockVerifiedTenantAttribute(),
    };

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [verifiedAttribute],
    };

    await writeInReadmodel(toReadModelTenant(tenant), tenants, 1);

    const updatedTenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          ...verifiedAttribute,
          verifiedBy: [
            {
              ...verifiedAttribute.verifiedBy[0],
              extensionDate: new Date(),
            },
          ],
        },
      ],
    };

    const payload: TenantVerifiedAttributeExtensionUpdatedV2 = {
      tenant: toTenantV2(updatedTenant),
      attributeId: verifiedAttribute.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantVerifiedAttributeExpirationUpdated",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantMailAdded", async () => {
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants, 1);

    const mail = getMockTenantMail();

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantMailDeleted", async () => {
    const mail = getMockTenantMail();

    const tenant: Tenant = {
      ...mockTenant,
      mails: [mail],
    };

    await writeInReadmodel(toReadModelTenant(tenant), tenants, 1);

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("TenantKindUpdated", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.GSP,
    };
    await writeInReadmodel(toReadModelTenant(tenant), tenants, 1);

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

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant?.data).toEqual(toReadModelTenant(updatedTenant));
    expect(retrievedTenant?.metadata).toEqual({
      version: 2,
    });
  });
  it("MaintenanceTenantDeleted", async () => {
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants, 1);

    const payload: MaintenanceTenantDeletedV2 = {
      tenantId: mockTenant.id,
    };

    const message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "MaintenanceTenantDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV2(message, tenants);

    const retrievedTenant = await tenants.findOne({
      "data.id": mockTenant.id,
    });

    expect(retrievedTenant).toBeNull();
  });
});
