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
  AttributeId,
  ContactId,
  CorrelationId,
  Tenant,
  TenantEvent,
  TenantEventEnvelope,
  TenantEventV3,
  TenantId,
  TenantKindV3,
  TenantMail,
  TenantV3,
  fromTenantV1,
  fromTenantV2,
  fromTenantV3,
  generateId,
  genericError,
  tenantEventToBinaryData,
  tenantKind,
  tenantMailKind,
  tenantUnitType,
  toTenantV3,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, expect, it } from "vitest";

const STREAM_VERSION = 7;

const toRawEventEnvelope = ({
  streamId,
  eventVersion,
  type,
  hexData,
}: {
  streamId: string;
  eventVersion: number;
  type: string;
  hexData: string;
}): Record<string, unknown> => ({
  sequence_num: 1,
  stream_id: streamId,
  version: STREAM_VERSION,
  correlation_id: generateId<CorrelationId>(),
  log_date: new Date(),
  event_version: eventVersion,
  type,
  data: hexData,
});

const toEventEnvelope = (
  streamId: string,
  event: TenantEvent
): Record<string, unknown> =>
  toRawEventEnvelope({
    streamId,
    eventVersion: event.event_version,
    type: event.type,
    hexData: Buffer.from(tenantEventToBinaryData(event)).toString("hex"),
  });

const captureError = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};

const contactId = generateId<ContactId>();

const tenant: Tenant = {
  ...getMockTenant(undefined, [
    getMockCertifiedTenantAttribute(),
    getMockCertifiedDiscreteTenantAttribute(),
    getMockDeclaredTenantAttribute(),
    getMockVerifiedTenantAttribute(),
  ]),
  kind: tenantKind.PA,
  subUnitType: tenantUnitType.AOO,
  selfcareInstitutionType: "PA",
  updatedAt: new Date(),
  features: [
    { type: "PersistentCertifier", certifierId: "IPA" },
    { type: "DelegatedProducer", availabilityTimestamp: new Date() },
    { type: "DelegatedConsumer", availabilityTimestamp: new Date() },
  ],
  remoteIds: [getMockTenantRemoteId()],
  contactId,
};

const tenantV3 = toTenantV3(tenant);
const tenantWithoutContact: Tenant = { ...tenant, contactId: undefined };
const tenantV3WithoutContact = toTenantV3(tenantWithoutContact);
const attributeId = generateId<AttributeId>();

const tenantEventsV3: TenantEventV3[] = [
  {
    event_version: 3,
    type: "TenantOnboarded",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantOnboardDetailsUpdated",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantCertifiedAttributeAssigned",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantCertifiedAttributeRevoked",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantCertifiedDiscreteAttributeAssigned",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantCertifiedDiscreteAttributeRevoked",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantCertifiedDiscreteAttributeUpdated",
    data: { attributeId, tenant: tenantV3, previousValue: 1, newValue: 2 },
  },
  {
    event_version: 3,
    type: "TenantDeclaredAttributeAssigned",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantDeclaredAttributeRevoked",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantVerifiedAttributeAssigned",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantVerifiedAttributeRevoked",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantVerifiedAttributeExpirationUpdated",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantVerifiedAttributeExtensionUpdated",
    data: { attributeId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "MaintenanceTenantDeleted",
    data: { tenantId: tenant.id, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "MaintenanceTenantUpdated",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantContactAdded",
    data: { contactId, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantKindUpdated",
    data: { oldKind: TenantKindV3.GSP, tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantContactDeleted",
    data: { contactId, tenant: tenantV3WithoutContact },
  },
  {
    event_version: 3,
    type: "MaintenanceTenantPromotedToCertifier",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantDelegatedProducerFeatureAdded",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantDelegatedProducerFeatureRemoved",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantDelegatedConsumerFeatureAdded",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantDelegatedConsumerFeatureRemoved",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "TenantRemoteIdAssigned",
    data: { tenant: tenantV3 },
  },
  {
    event_version: 3,
    type: "MaintenanceTenantRemoteIdDeleted",
    data: { tenant: tenantV3 },
  },
];

describe("Tenant V3 events", () => {
  it("should cover every V3 tenant event contract", () => {
    const v3EventTypes = TenantEventV3.options.map(
      (option) => option.shape.type.value
    );

    expect(new Set(tenantEventsV3.map((event) => event.type))).toEqual(
      new Set(v3EventTypes)
    );
    expect(tenantEventsV3).toHaveLength(v3EventTypes.length);
  });

  it("should round-trip a tenant with a contact reference through TenantV3 protobuf", () => {
    const protobuf = TenantV3.fromBinary(TenantV3.toBinary(toTenantV3(tenant)));

    expect(fromTenantV3(protobuf)).toEqual({ ...tenant, mails: [] });
  });

  it("should round-trip a tenant without a contact reference through TenantV3 protobuf", () => {
    const protobuf = TenantV3.fromBinary(
      TenantV3.toBinary(toTenantV3(tenantWithoutContact))
    );
    const actualTenant = fromTenantV3(protobuf);

    expect(actualTenant.contactId).toBeUndefined();
    expect(actualTenant).toEqual(tenantWithoutContact);
  });

  it("should represent the contact only through its opaque reference", () => {
    const json = TenantV3.toJson(toTenantV3(tenant)) as Record<string, unknown>;

    expect(json).not.toHaveProperty("mails");
    expect(json).toHaveProperty("contactId", contactId);
  });

  it("should refuse to serialize a tenant with legacy mails to V3", () => {
    const tenantWithLegacyMails: Tenant = {
      ...tenant,
      mails: [getMockTenantMail()],
    };

    expect(() => toTenantV3(tenantWithLegacyMails)).toThrowError(
      genericError(
        `Tenant ${tenant.id} has legacy mails and cannot be serialized to V3`
      )
    );
  });

  it.each(tenantEventsV3)(
    "should serialize and deserialize the $type V3 event",
    (event) => {
      const decoded = TenantEventEnvelope.parse(
        toEventEnvelope(tenant.id, event)
      );

      expect(decoded.event_version).toBe(3);
      expect(decoded.version).toBe(STREAM_VERSION);
      expect(decoded.type).toBe(event.type);

      const decodedData = match(decoded)
        .with({ event_version: 3 }, ({ data }) => data)
        .otherwise(() => undefined);
      expect(decodedData).toEqual(event.data);

      const decodedTenant = decodedData?.tenant
        ? fromTenantV3(decodedData.tenant)
        : undefined;
      const expectedTenant = match(event)
        .with({ type: "TenantContactDeleted" }, () => tenantWithoutContact)
        .otherwise(() => tenant);
      expect(decodedTenant).toEqual({ ...expectedTenant, mails: [] });
    }
  );

  it("should reference the added contact in the TenantContactAdded V3 event and in the resulting tenant", () => {
    const event: TenantEventV3 = {
      event_version: 3,
      type: "TenantContactAdded",
      data: { contactId, tenant: tenantV3 },
    };

    const decoded = TenantEventEnvelope.parse(
      toEventEnvelope(tenant.id, event)
    );

    const decodedData = match(decoded)
      .with(
        { event_version: 3, type: "TenantContactAdded" },
        ({ data }) => data
      )
      .otherwise(() => undefined);
    const decodedTenant = decodedData?.tenant
      ? fromTenantV3(decodedData.tenant)
      : undefined;

    expect(decodedData?.contactId).toBe(contactId);
    expect(decodedData).not.toHaveProperty("mailId");
    expect(decodedTenant?.contactId).toBe(contactId);
  });

  it("should reference the deleted contact only in the TenantContactDeleted V3 event, not in the resulting tenant", () => {
    const event: TenantEventV3 = {
      event_version: 3,
      type: "TenantContactDeleted",
      data: { contactId, tenant: tenantV3WithoutContact },
    };

    const decoded = TenantEventEnvelope.parse(
      toEventEnvelope(tenant.id, event)
    );

    const decodedData = match(decoded)
      .with(
        { event_version: 3, type: "TenantContactDeleted" },
        ({ data }) => data
      )
      .otherwise(() => undefined);
    const decodedTenant = decodedData?.tenant
      ? fromTenantV3(decodedData.tenant)
      : undefined;

    expect(decodedData?.contactId).toBe(contactId);
    expect(decodedData).not.toHaveProperty("mailId");
    expect(decodedData?.tenant).not.toHaveProperty("contactId");
    expect(decodedTenant?.contactId).toBeUndefined();
    expect(decodedTenant).toEqual({ ...tenantWithoutContact, mails: [] });
  });
});

describe("Tenant V3 contact reference validation", () => {
  const plainTextEmail = "mario.rossi@example.test";
  const opaqueContactIdError = genericError(
    "Tenant V3 event rejected: contactId is not an opaque contact identifier"
  );

  const contactEventTypes = [
    "TenantContactAdded",
    "TenantContactDeleted",
  ] as const;

  const nonOpaqueContactIdCases = contactEventTypes.flatMap((type) => [
    { type, description: "a plain-text email", value: plainTextEmail },
    { type, description: "an empty string", value: "" },
    { type, description: "a non-UUID identifier", value: "contact-1" },
  ]);

  it.each(nonOpaqueContactIdCases)(
    "should refuse to serialize a $type V3 event whose contactId is $description",
    ({ type, value }) => {
      // The tenant itself carries a valid opaque reference: the check on the
      // event-specific contactId must not depend on it.
      const event: TenantEventV3 = {
        event_version: 3,
        type,
        data: { contactId: value, tenant: tenantV3 },
      };

      expect(() => tenantEventToBinaryData(event)).toThrowError(
        opaqueContactIdError
      );
    }
  );

  it.each(tenantEventsV3)(
    "should refuse to serialize the $type V3 event when its tenant references a non-opaque contactId",
    (event) => {
      const eventWithPlainTextContact = {
        ...event,
        data: {
          ...event.data,
          tenant: { ...tenantV3, contactId: plainTextEmail },
        },
      } as TenantEventV3;

      expect(() =>
        tenantEventToBinaryData(eventWithPlainTextContact)
      ).toThrowError(opaqueContactIdError);
    }
  );

  it("should not include the rejected contactId in the error", () => {
    const event: TenantEventV3 = {
      event_version: 3,
      type: "TenantContactAdded",
      data: { contactId: plainTextEmail, tenant: tenantV3 },
    };

    const error = captureError(() => tenantEventToBinaryData(event));

    expect(error).toEqual(opaqueContactIdError);
    expect(String(error)).not.toContain(plainTextEmail);
    expect(JSON.stringify(error)).not.toContain(plainTextEmail);
  });
});

describe("Tenant legacy events", () => {
  /**
   * Frozen binary payloads, encoded with the V1/V2 schemas and never re-encoded
   * by the current serializers: they stand for events already stored in the
   * event store, so any change that breaks their decoding is caught here.
   * Content: a tenant with a single legacy contact email (synthetic data).
   */
  const LEGACY_TENANT_MAIL_ADDED_V1_HEX =
    "0a2438623662366134652d316636612d346333652d396135312d326230623763316439653031122431633966306334652d336232612d346438652d386637612d3662356334643365326631301ae8010a2438623662366134652d316636612d346333652d396135312d326230623763316439653031122435663363326131622d376434652d346238612d396336662d3065316432633362346135391a160a03495041120f6c65676163795f6970615f636f64653080d095ffbc3138c09fbaffbc31425c0801121b6c65676163792e636f6e74616374406578616d706c652e7465737418e0f7a7ffbc31220e4c656761637920636f6e746163742a2431633966306334652d336232612d346438652d386637612d3662356334643365326631304a0d4c65676163792054656e616e7450015880d095ffbc31";
  const LEGACY_TENANT_MAIL_ADDED_V2_HEX =
    "0a2431633966306334652d336232612d346438652d386637612d36623563346433653266313012ea010a2438623662366134652d316636612d346333652d396135312d326230623763316439653031122435663363326131622d376434652d346238612d396336662d3065316432633362346135391a160a03495041120f6c65676163795f6970615f636f64653080d095ffbc3138c09fbaffbc31425a121b6c65676163792e636f6e74616374406578616d706c652e7465737418e0f7a7ffbc31220e4c656761637920636f6e746163742a2431633966306334652d336232612d346438652d386637612d3662356334643365326631304a0d4c65676163792054656e616e7450005880d095ffbc316a025041";

  const legacyMail: TenantMail = {
    id: "1c9f0c4e-3b2a-4d8e-8f7a-6b5c4d3e2f10",
    kind: tenantMailKind.ContactEmail,
    address: "legacy.contact@example.test",
    description: "Legacy contact",
    createdAt: new Date(1700000300000),
  };

  const legacyTenant: Tenant = {
    id: unsafeBrandId<TenantId>("8b6b6a4e-1f6a-4c3e-9a51-2b0b7c1d9e01"),
    selfcareId: "5f3c2a1b-7d4e-4b8a-9c6f-0e1d2c3b4a59",
    externalId: { origin: "IPA", value: "legacy_ipa_code" },
    features: [],
    attributes: [],
    createdAt: new Date(1700000000000),
    updatedAt: new Date(1700000600000),
    mails: [legacyMail],
    name: "Legacy Tenant",
    kind: tenantKind.PA,
    onboardedAt: new Date(1700000000000),
  };

  it("should still decode a stored V2 TenantMailAdded payload carrying a legacy mail", () => {
    const decoded = TenantEventEnvelope.parse(
      toRawEventEnvelope({
        streamId: legacyTenant.id,
        eventVersion: 2,
        type: "TenantMailAdded",
        hexData: LEGACY_TENANT_MAIL_ADDED_V2_HEX,
      })
    );

    expect(decoded.event_version).toBe(2);
    expect(decoded.version).toBe(STREAM_VERSION);

    const decodedData = match(decoded)
      .with({ event_version: 2, type: "TenantMailAdded" }, ({ data }) => data)
      .otherwise(() => undefined);
    const decodedTenant = decodedData?.tenant
      ? fromTenantV2(decodedData.tenant)
      : undefined;

    expect(decodedData?.mailId).toBe(legacyMail.id);
    expect(decodedTenant).toEqual({
      ...legacyTenant,
      selfcareInstitutionType: "PA",
      remoteIds: [],
    });
    expect(decodedTenant?.contactId).toBeUndefined();
  });

  it("should still decode a stored V1 TenantMailAdded payload carrying a legacy mail", () => {
    const decoded = TenantEventEnvelope.parse(
      toRawEventEnvelope({
        streamId: legacyTenant.id,
        eventVersion: 1,
        type: "TenantMailAdded",
        hexData: LEGACY_TENANT_MAIL_ADDED_V1_HEX,
      })
    );

    expect(decoded.event_version).toBe(1);
    expect(decoded.version).toBe(STREAM_VERSION);

    const decodedData = match(decoded)
      .with({ event_version: 1, type: "TenantMailAdded" }, ({ data }) => data)
      .otherwise(() => undefined);
    const decodedTenant = decodedData?.tenant
      ? fromTenantV1(decodedData.tenant)
      : undefined;

    expect(decodedData?.tenantId).toBe(legacyTenant.id);
    expect(decodedData?.mailId).toBe(legacyMail.id);
    expect(decodedTenant).toEqual(legacyTenant);
    expect(decodedTenant?.contactId).toBeUndefined();
  });
});
