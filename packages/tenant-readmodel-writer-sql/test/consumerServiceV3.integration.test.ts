import { genericLogger } from "pagopa-interop-commons";
import { getMockTenant, getMockTenantMail } from "pagopa-interop-commons-test";
import {
  AttributeId,
  ContactId,
  Tenant,
  TenantEventEnvelopeV2,
  TenantEventEnvelopeV3,
  generateId,
  missingKafkaMessageDataError,
  toTenantV2,
  toTenantV3,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { handleMessageV2 } from "../src/consumerServiceV2.js";
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

  // Every V3 event that upserts the tenant, except the contact events, which
  // have their own tests.
  const contactTenant: Tenant = {
    ...mockTenant,
    contactId: generateId<ContactId>(),
  };
  const contactTenantV3 = toTenantV3(contactTenant);
  const attributeId = generateId<AttributeId>();
  const base = { ...mockMessage, version: 2 };
  const eventsKeepingTheContact: TenantEventEnvelopeV3[] = [
    {
      ...base,
      type: "TenantOnboarded",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantOnboardDetailsUpdated",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantCertifiedAttributeAssigned",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantCertifiedAttributeRevoked",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantCertifiedDiscreteAttributeAssigned",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantCertifiedDiscreteAttributeRevoked",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantCertifiedDiscreteAttributeUpdated",
      data: {
        attributeId,
        tenant: contactTenantV3,
        previousValue: 1,
        newValue: 2,
      },
    },
    {
      ...base,
      type: "TenantDeclaredAttributeAssigned",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantDeclaredAttributeRevoked",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantVerifiedAttributeAssigned",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantVerifiedAttributeRevoked",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantVerifiedAttributeExpirationUpdated",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantVerifiedAttributeExtensionUpdated",
      data: { attributeId, tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "MaintenanceTenantUpdated",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantKindUpdated",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "MaintenanceTenantPromotedToCertifier",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantDelegatedProducerFeatureAdded",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantDelegatedProducerFeatureRemoved",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantDelegatedConsumerFeatureAdded",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantDelegatedConsumerFeatureRemoved",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "TenantRemoteIdAssigned",
      data: { tenant: contactTenantV3 },
    },
    {
      ...base,
      type: "MaintenanceTenantRemoteIdDeleted",
      data: { tenant: contactTenantV3 },
    },
  ];

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

  it.each(eventsKeepingTheContact)(
    "$type keeps the contact reference",
    async (message) => {
      await tenantWriterService.upsertTenant(contactTenant, 1);

      await handleMessageV3(message, tenantWriterService);

      const retrievedTenant = await tenantReadModelService.getTenantById(
        mockTenant.id
      );

      expect(retrievedTenant?.data).toStrictEqual(contactTenant);
      expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
    }
  );

  it("TenantOnboarded inserts a tenant not in the readmodel with its contact", async () => {
    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantOnboarded",
      data: { tenant: contactTenantV3 },
    };

    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(contactTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 1 });
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

  it("drops the contact reference on a later V2 event, logging a warning", async () => {
    const contactId = generateId<ContactId>();
    const contactAdded: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: { contactId, tenant: toTenantV3({ ...mockTenant, contactId }) },
      version: 1,
    };
    await handleMessageV3(contactAdded, tenantWriterService);

    // A V2 event carries no contact reference.
    const v2Message: TenantEventEnvelopeV2 = {
      ...mockMessage,
      event_version: 2,
      type: "TenantOnboardDetailsUpdated",
      data: { tenant: toTenantV2(mockTenant) },
      version: 2,
    };
    const warn = vi.spyOn(genericLogger, "warn");

    await handleMessageV2(v2Message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(mockTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
    expect(warn).toHaveBeenCalledWith(
      `Tenant ${mockTenant.id} lost its contact reference ${contactId}: V2 event TenantOnboardDetailsUpdated carries no contact`
    );
    warn.mockRestore();
  });

  it("handles an event replayed at the same version idempotently", async () => {
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
    await handleMessageV3(message, tenantWriterService);

    const retrievedTenant = await tenantReadModelService.getTenantById(
      mockTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
  });

  it("rejects an event without the tenant", async () => {
    const message: TenantEventEnvelopeV3 = {
      ...mockMessage,
      type: "TenantContactAdded",
      data: { contactId: generateId<ContactId>() },
    };
    const expectedError = missingKafkaMessageDataError(
      "tenant",
      "TenantContactAdded"
    );

    await expect(handleMessageV3(message, tenantWriterService)).rejects.toThrow(
      expectedError
    );
  });

  it("ignores an event older than the readmodel version", async () => {
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

  it("accepts a contact already referenced by another tenant", async () => {
    const contactId = generateId<ContactId>();
    const otherTenant: Tenant = { ...getMockTenant(), contactId };
    await tenantWriterService.upsertTenant(otherTenant, 1);
    await tenantWriterService.upsertTenant(mockTenant, 1);

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
    const retrievedOtherTenant = await tenantReadModelService.getTenantById(
      otherTenant.id
    );

    expect(retrievedTenant?.data).toStrictEqual(updatedTenant);
    expect(retrievedTenant?.metadata).toStrictEqual({ version: 2 });
    expect(retrievedOtherTenant?.data).toStrictEqual(otherTenant);
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
