import {
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  ContactId,
  Tenant,
  TenantEventEnvelopeV3,
  generateId,
  toTenantV3,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { handleMessageV3 } from "../src/consumerServiceV3.js";
import {
  getCustomMockCertifiedTenantAttribute,
  tenantReadModelService,
  tenantWriterService,
} from "./utils.js";

describe("Tenant Events V3", async () => {
  const mockTenant = getMockTenant();
  const mockMessage: Omit<TenantEventEnvelopeV3, "type" | "data"> = {
    event_version: 3,
    stream_id: mockTenant.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
  };

  it("TenantContactAdded", async () => {
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const contactId = generateId<ContactId>();
    const updatedTenant: Tenant = { ...mockTenant, contactId };

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: { contactId, tenant: toTenantV3(updatedTenant) },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
  });

  it("TenantContactAdded replacing the current contact", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      contactId: generateId<ContactId>(),
    };
    await tenantWriterService.upsertTenant(tenant, 1);

    const newContactId = generateId<ContactId>();
    const updatedTenant: Tenant = { ...mockTenant, contactId: newContactId };

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: { contactId: newContactId, tenant: toTenantV3(updatedTenant) },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
  });

  it("TenantContactDeleted", async () => {
    const contactId = generateId<ContactId>();
    await tenantWriterService.upsertTenant({ ...mockTenant, contactId }, 1);

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactDeleted",
      data: { contactId, tenant: toTenantV3(mockTenant) },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(mockTenant);
    expect(retrievedTenant?.data.contactId).toBeUndefined();
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
  });

  it("preserves the contact across events that do not change it", async () => {
    const contactId = generateId<ContactId>();
    const tenant: Tenant = { ...mockTenant, contactId };
    await tenantWriterService.upsertTenant(tenant, 1);

    const attribute = getCustomMockCertifiedTenantAttribute();
    const updatedTenant: Tenant = { ...tenant, attributes: [attribute] };

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantCertifiedAttributeAssigned",
      data: { attributeId: attribute.id, tenant: toTenantV3(updatedTenant) },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.data.contactId).toBe(contactId);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
  });

  it("drops the legacy mails of a tenant on its first V3 event", async () => {
    await tenantWriterService.upsertTenant(
      { ...mockTenant, mails: [getMockTenantMail()] },
      1
    );

    const contactId = generateId<ContactId>();
    const updatedTenant: Tenant = { ...mockTenant, contactId };

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: { contactId, tenant: toTenantV3(updatedTenant) },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.data.mails).toEqual([]);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
  });

  it("ignores an event already processed or older than the readmodel version", async () => {
    const currentContactId = generateId<ContactId>();
    const currentTenant: Tenant = {
      ...mockTenant,
      contactId: currentContactId,
    };
    await tenantWriterService.upsertTenant(currentTenant, 3);

    const staleContactId = generateId<ContactId>();
    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: {
        contactId: staleContactId,
        tenant: toTenantV3({ ...mockTenant, contactId: staleContactId }),
      },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(currentTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 3 });
  });

  it("rejects a contact already referenced by another tenant", async () => {
    const contactId = generateId<ContactId>();
    const otherTenant: Tenant = { ...getMockTenant(), contactId };
    await tenantWriterService.upsertTenant(otherTenant, 1);
    await tenantWriterService.upsertTenant(mockTenant, 1);

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: {
        contactId,
        tenant: toTenantV3({ ...mockTenant, contactId }),
      },
      version: 2,
    };

    await expect(
      handleMessageV3(message, tenantWriterService)
    ).rejects.toThrow();

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(mockTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 1 });
  });

  it("MaintenanceTenantDeleted", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      contactId: generateId<ContactId>(),
    };
    await tenantWriterService.upsertTenant(tenant, 1);

    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "MaintenanceTenantDeleted",
      data: { tenantId: tenant.id, tenant: toTenantV3(tenant) },
      version: 2,
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant).toBeUndefined();
  });
});
