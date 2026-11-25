/* eslint-disable functional/immutable-data */
import { CreateEvent } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockContextMaintenance,
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
  TenantEventV2,
  TenantEventV3,
  generateId,
  tenantEventToBinaryData,
  tenantKind,
} from "pagopa-interop-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
import { afterEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  tenantContactRequiresEventsV3,
  tenantLegacyMailsNotMigrated,
} from "../../src/model/domain/errors.js";
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
  toCreateEventTenantMailAdded,
  toCreateEventTenantMailDeleted,
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
  readLastTenantEvent,
  readModelDB,
  tenantService,
} from "../integrationUtils.js";

const setTenantEventsV3 = (enabled: boolean): void => {
  (config as Record<string, unknown>).featureFlagTenantEventsV3 = enabled;
};

describe("Tenant events version", () => {
  const tenantWithContact: Tenant = {
    ...getMockTenant(),
    contactId: generateId<ContactId>(),
  };
  const tenantWithoutContact = getMockTenant();
  const tenantWithLegacyMails: Tenant = {
    ...getMockTenant(),
    mails: [getMockTenantMail()],
  };
  const attributeId = generateId<AttributeId>();
  const correlationId = generateId<CorrelationId>();

  type EventBuilder = [TenantEvent["type"], () => CreateEvent<TenantEvent>];

  const switchableBuilders = (tenant: Tenant): EventBuilder[] => [
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

  afterEach(() => {
    setTenantEventsV3(false);
  });

  it.each(switchableBuilders(tenantWithoutContact))(
    "Should build %s as V2 when tenant events V3 are disabled",
    (type, build) => {
      setTenantEventsV3(false);

      const { event } = build();

      expect(event).toMatchObject({ type, event_version: 2 });
      const decoded = TenantEventV2.parse({
        type,
        event_version: 2,
        data: tenantEventToBinaryData(event),
      });
      expect(decoded.type).toBe(type);
    }
  );

  it.each(switchableBuilders(tenantWithContact))(
    "Should refuse to build %s as V2 for a tenant with a contact",
    (_type, build) => {
      setTenantEventsV3(false);

      expect(build).toThrow(
        tenantContactRequiresEventsV3(tenantWithContact.id)
      );
    }
  );

  it.each(switchableBuilders(tenantWithLegacyMails))(
    "Should build %s as V2 with the legacy mails when tenant events V3 are disabled",
    (type, build) => {
      setTenantEventsV3(false);

      const { event } = build();

      expect(event).toMatchObject({ type, event_version: 2 });
      const decoded = TenantEventV2.parse({
        type,
        event_version: 2,
        data: tenantEventToBinaryData(event),
      });
      expect(decoded).toMatchObject({
        data: {
          tenant: {
            mails: tenantWithLegacyMails.mails.map(({ id, address }) => ({
              id,
              address,
            })),
          },
        },
      });
    }
  );

  it.each(switchableBuilders(tenantWithLegacyMails))(
    "Should refuse to build %s as V3 for a tenant with legacy mails",
    (_type, build) => {
      setTenantEventsV3(true);

      expect(build).toThrow(
        tenantLegacyMailsNotMigrated(tenantWithLegacyMails.id)
      );
    }
  );

  it.each(switchableBuilders(tenantWithContact))(
    "Should build %s as V3 with the contact reference when tenant events V3 are enabled",
    (type, build) => {
      setTenantEventsV3(true);

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

  it.each([false, true])(
    "Should always build the mail events as V2 (tenant events V3 enabled: %s)",
    (enabled) => {
      setTenantEventsV3(enabled);

      expect(
        toCreateEventTenantMailAdded(
          1,
          tenantWithoutContact,
          generateId(),
          correlationId
        ).event
      ).toMatchObject({ type: "TenantMailAdded", event_version: 2 });
      expect(
        toCreateEventTenantMailDeleted(
          1,
          tenantWithoutContact,
          generateId(),
          correlationId
        ).event
      ).toMatchObject({ type: "TenantMailDeleted", event_version: 2 });
    }
  );

  it("Should refuse to build the mail events for a tenant with a contact", () => {
    const error = tenantContactRequiresEventsV3(tenantWithContact.id);

    expect(() =>
      toCreateEventTenantMailAdded(
        1,
        tenantWithContact,
        generateId(),
        correlationId
      )
    ).toThrow(error);
    expect(() =>
      toCreateEventTenantMailDeleted(
        1,
        tenantWithContact,
        generateId(),
        correlationId
      )
    ).toThrow(error);
  });

  it("Should refuse to build the contact events for a tenant with legacy mails", () => {
    const error = tenantLegacyMailsNotMigrated(tenantWithLegacyMails.id);
    const contactId = generateId<ContactId>();

    expect(() =>
      toCreateEventTenantContactAdded(
        1,
        tenantWithLegacyMails,
        contactId,
        correlationId
      )
    ).toThrow(error);
    expect(() =>
      toCreateEventTenantContactDeleted(
        1,
        tenantWithLegacyMails,
        contactId,
        correlationId
      )
    ).toThrow(error);
  });

  it.each([false, true])(
    "Should always build the contact events as V3 (tenant events V3 enabled: %s)",
    (enabled) => {
      setTenantEventsV3(enabled);
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
    }
  );

  it("Should continue a V2 tenant stream with V3 events and contiguous versions", async () => {
    setTenantEventsV3(true);

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

  it("Should refuse to write a V3 event for a tenant read with legacy mails, without writing events", async () => {
    setTenantEventsV3(true);

    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(tenant);

    await expect(
      tenantService.maintenanceTenantDelete(
        { tenantId: tenant.id, version: 0 },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantLegacyMailsNotMigrated(tenant.id));

    expect(await readLastTenantEvent(tenant.id)).toMatchObject({
      version: "0",
      type: "TenantOnboarded",
    });
  });

  it("Should refuse to write a V2 event for a tenant read with a contact, without writing events", async () => {
    setTenantEventsV3(false);

    const tenant: Tenant = {
      ...getMockTenant(),
      contactId: generateId<ContactId>(),
    };
    await addOneTenant(tenant);

    await expect(
      tenantService.maintenanceTenantDelete(
        { tenantId: tenant.id, version: 0 },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantContactRequiresEventsV3(tenant.id));

    expect(await readLastTenantEvent(tenant.id)).toMatchObject({
      version: "0",
      type: "TenantOnboarded",
    });
  });
});
