/* eslint-disable functional/immutable-data */
import { CreateEvent } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockTenant,
  getMockTenantMail,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  ContactId,
  CorrelationId,
  Tenant,
  TenantEvent,
  TenantEventV3,
  generateId,
  tenantEventToBinaryData,
  tenantKind,
} from "pagopa-interop-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
import { describe, expect, it } from "vitest";

import {
  toCreateEventMaintenanceTenantDeleted,
  toCreateEventMaintenanceTenantPromotedToCertifier,
  toCreateEventMaintenanceTenantRemoteIdDeleted,
  toCreateEventMaintenanceTenantUpdated,
  toCreateEventTenantCertifiedAttributeAssigned,
  toCreateEventTenantCertifiedAttributeRevoked,
  toCreateEventTenantCertifiedDiscreteAttributeAssigned,
  toCreateEventTenantCertifiedDiscreteAttributeRevoked,
  toCreateEventTenantCertifiedDiscreteAttributeUpdated,
  toCreateEventTenantContactAdded,
  toCreateEventTenantContactDeleted,
  toCreateEventTenantDeclaredAttributeAssigned,
  toCreateEventTenantDeclaredAttributeRevoked,
  toCreateEventTenantDelegatedConsumerFeatureAdded,
  toCreateEventTenantDelegatedConsumerFeatureRemoved,
  toCreateEventTenantDelegatedProducerFeatureAdded,
  toCreateEventTenantDelegatedProducerFeatureRemoved,
  toCreateEventTenantKindUpdated,
  toCreateEventTenantOnboardDetailsUpdated,
  toCreateEventTenantOnboarded,
  toCreateEventTenantRemoteIdAssigned,
  toCreateEventTenantVerifiedAttributeAssigned,
  toCreateEventTenantVerifiedAttributeExpirationUpdated,
  toCreateEventTenantVerifiedAttributeExtensionUpdated,
  toCreateEventTenantVerifiedAttributeRevoked,
} from "../../src/model/domain/toEvent.js";
import {
  addOneTenant,
  postgresDB,
  readModelDB,
  tenantService,
} from "../integrationUtils.js";

describe("Tenant events version", () => {
  const tenantWithContact: Tenant = {
    ...getMockTenant(),
    contactId: generateId<ContactId>(),
  };
  const tenantWithoutContact = getMockTenant();
  const tenantWithMails: Tenant = {
    ...getMockTenant(),
    mails: [getMockTenantMail()],
  };
  const attributeId = generateId<AttributeId>();
  const correlationId = generateId<CorrelationId>();

  type EventBuilder = [TenantEvent["type"], () => CreateEvent<TenantEvent>];

  const builders = (tenant: Tenant): EventBuilder[] => [
    [
      "TenantOnboarded",
      () => toCreateEventTenantOnboarded(tenant, correlationId),
    ],
    [
      "TenantOnboardDetailsUpdated",
      () =>
        toCreateEventTenantOnboardDetailsUpdated(
          tenant.id,
          1,
          tenant,
          correlationId
        ),
    ],
    [
      "TenantVerifiedAttributeExtensionUpdated",
      () =>
        toCreateEventTenantVerifiedAttributeExtensionUpdated(
          tenant.id,
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantVerifiedAttributeExpirationUpdated",
      () =>
        toCreateEventTenantVerifiedAttributeExpirationUpdated(
          tenant.id,
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantCertifiedAttributeAssigned",
      () =>
        toCreateEventTenantCertifiedAttributeAssigned(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantKindUpdated",
      () =>
        toCreateEventTenantKindUpdated(1, tenantKind.PA, tenant, correlationId),
    ],
    [
      "TenantCertifiedAttributeRevoked",
      () =>
        toCreateEventTenantCertifiedAttributeRevoked(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantDeclaredAttributeAssigned",
      () =>
        toCreateEventTenantDeclaredAttributeAssigned(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "MaintenanceTenantDeleted",
      () => toCreateEventMaintenanceTenantDeleted(1, tenant, correlationId),
    ],
    [
      "MaintenanceTenantUpdated",
      () => toCreateEventMaintenanceTenantUpdated(1, tenant, correlationId),
    ],
    [
      "TenantVerifiedAttributeAssigned",
      () =>
        toCreateEventTenantVerifiedAttributeAssigned(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantVerifiedAttributeRevoked",
      () =>
        toCreateEventTenantVerifiedAttributeRevoked(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantDeclaredAttributeRevoked",
      () =>
        toCreateEventTenantDeclaredAttributeRevoked(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "MaintenanceTenantPromotedToCertifier",
      () =>
        toCreateEventMaintenanceTenantPromotedToCertifier(
          1,
          tenant,
          correlationId
        ),
    ],
    [
      "TenantDelegatedProducerFeatureAdded",
      () =>
        toCreateEventTenantDelegatedProducerFeatureAdded(
          1,
          tenant,
          correlationId
        ),
    ],
    [
      "TenantDelegatedProducerFeatureRemoved",
      () =>
        toCreateEventTenantDelegatedProducerFeatureRemoved(
          1,
          tenant,
          correlationId
        ),
    ],
    [
      "TenantDelegatedConsumerFeatureAdded",
      () =>
        toCreateEventTenantDelegatedConsumerFeatureAdded(
          1,
          tenant,
          correlationId
        ),
    ],
    [
      "TenantDelegatedConsumerFeatureRemoved",
      () =>
        toCreateEventTenantDelegatedConsumerFeatureRemoved(
          1,
          tenant,
          correlationId
        ),
    ],
    [
      "TenantRemoteIdAssigned",
      () => toCreateEventTenantRemoteIdAssigned(1, tenant, correlationId),
    ],
    [
      "TenantCertifiedDiscreteAttributeAssigned",
      () =>
        toCreateEventTenantCertifiedDiscreteAttributeAssigned(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantCertifiedDiscreteAttributeRevoked",
      () =>
        toCreateEventTenantCertifiedDiscreteAttributeRevoked(
          1,
          tenant,
          attributeId,
          correlationId
        ),
    ],
    [
      "TenantCertifiedDiscreteAttributeUpdated",
      () =>
        toCreateEventTenantCertifiedDiscreteAttributeUpdated(
          1,
          tenant,
          attributeId,
          1,
          2,
          correlationId
        ),
    ],
    [
      "MaintenanceTenantRemoteIdDeleted",
      () =>
        toCreateEventMaintenanceTenantRemoteIdDeleted(1, tenant, correlationId),
    ],
  ];

  it.each(builders(tenantWithContact))(
    "Should build %s as V3 with the contact reference",
    (type, build) => {
      const { event } = build();

      expect(event).toMatchObject({ type, event_version: 3 });
      const decoded = TenantEventV3.parse({
        type,
        event_version: 3,
        data: tenantEventToBinaryData(event),
      });
      expect(decoded.type).toBe(type);
      expect(decoded.data.tenant?.contactId).toBe(tenantWithContact.contactId);
    }
  );

  it.each(builders(tenantWithoutContact))(
    "Should build %s as V3 for a tenant without a contact",
    (type, build) => {
      const { event } = build();

      expect(event).toMatchObject({ type, event_version: 3 });
      const decoded = TenantEventV3.parse({
        type,
        event_version: 3,
        data: tenantEventToBinaryData(event),
      });
      expect(decoded.data.tenant?.contactId).toBeUndefined();
    }
  );

  it.each(builders(tenantWithMails))(
    "Should refuse to build %s for a tenant that still has legacy mails",
    (_type, build) => {
      expect(build).toThrow(
        `Tenant ${tenantWithMails.id} has legacy mails and cannot be serialized to V3`
      );
    }
  );

  it("Should build the contact events as V3", () => {
    const contactId = generateId<ContactId>();

    expect(
      toCreateEventTenantContactAdded(
        1,
        tenantWithContact,
        contactId,
        correlationId
      ).event
    ).toMatchObject({
      type: "TenantContactAdded",
      event_version: 3,
      data: { contactId },
    });
    expect(
      toCreateEventTenantContactDeleted(
        1,
        tenantWithContact,
        contactId,
        correlationId
      ).event
    ).toMatchObject({
      type: "TenantContactDeleted",
      event_version: 3,
      data: { contactId },
    });
  });

  it("Should continue a V2 tenant stream with V3 events and contiguous versions", async () => {
    const streamTenant = getMockTenant();
    await addOneTenant(streamTenant);

    const contactId = generateId<ContactId>();
    const { data: tenantWithContact, metadata } =
      await tenantService.addTenantContact(
        { tenantId: streamTenant.id, contactId },
        getMockContext({ authData: getMockAuthData(streamTenant.id) })
      );
    await upsertTenant(readModelDB, tenantWithContact, metadata.version);

    await tenantService.deleteTenantContact(
      { tenantId: streamTenant.id, contactId },
      getMockContext({ authData: getMockAuthData(streamTenant.id) })
    );

    expect(
      await readEventByStreamIdAndVersion(
        streamTenant.id,
        0,
        "tenant",
        postgresDB
      )
    ).toMatchObject({
      stream_id: streamTenant.id,
      version: "0",
      type: "TenantOnboarded",
      event_version: 2,
    });
    expect(
      await readEventByStreamIdAndVersion(
        streamTenant.id,
        1,
        "tenant",
        postgresDB
      )
    ).toMatchObject({
      stream_id: streamTenant.id,
      version: "1",
      type: "TenantContactAdded",
      event_version: 3,
    });
    expect(
      await readEventByStreamIdAndVersion(
        streamTenant.id,
        2,
        "tenant",
        postgresDB
      )
    ).toMatchObject({
      stream_id: streamTenant.id,
      version: "2",
      type: "TenantContactDeleted",
      event_version: 3,
    });
  });
});
