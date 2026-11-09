import {
  getMockCertifiedDiscreteTenantAttribute,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockTenant,
  getMockTenantMail,
  getMockTenantRemoteId,
  getMockVerifiedTenantAttribute,
  toTenantV1,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  ContactId,
  CorrelationId,
  Tenant,
  TenantEvent,
  TenantEventEnvelope,
  TenantEventV1,
  TenantEventV2,
  TenantEventV3,
  TenantKindV3,
  TenantV3,
  fromTenantV1,
  fromTenantV2,
  fromTenantV3,
  generateId,
  genericError,
  tenantEventToBinaryData,
  tenantKind,
  tenantUnitType,
  toTenantV2,
  toTenantV3,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, expect, it } from "vitest";

const STREAM_VERSION = 7;

const toEventEnvelope = (
  streamId: string,
  event: TenantEvent
): Record<string, unknown> => ({
  sequence_num: 1,
  stream_id: streamId,
  version: STREAM_VERSION,
  correlation_id: generateId<CorrelationId>(),
  log_date: new Date(),
  event_version: event.event_version,
  type: event.type,
  data: Buffer.from(tenantEventToBinaryData(event)).toString("hex"),
});

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
    data: { contactId, tenant: tenantV3 },
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
    const tenantWithoutContact: Tenant = { ...tenant, contactId: undefined };

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
      expect(decodedTenant).toEqual({ ...tenant, mails: [] });
    }
  );

  it.each(["TenantContactAdded", "TenantContactDeleted"] as const)(
    "should carry the contact reference instead of the legacy mail id in the %s V3 event",
    (type) => {
      const event: TenantEventV3 = {
        event_version: 3,
        type,
        data: { contactId, tenant: tenantV3 },
      };

      const decoded = TenantEventEnvelope.parse(
        toEventEnvelope(tenant.id, event)
      );

      const decodedData = match(decoded)
        .with(
          { event_version: 3, type: "TenantContactAdded" },
          { event_version: 3, type: "TenantContactDeleted" },
          ({ data }) => data
        )
        .otherwise(() => undefined);

      expect(decodedData?.contactId).toBe(contactId);
      expect(decodedData).not.toHaveProperty("mailId");
    }
  );
});

describe("Tenant legacy events", () => {
  const mail = getMockTenantMail();
  const legacyTenant: Tenant = { ...getMockTenant(), mails: [mail] };

  it("should still decode V2 events carrying legacy mails", () => {
    const event: TenantEventV2 = {
      event_version: 2,
      type: "TenantMailAdded",
      data: { mailId: mail.id, tenant: toTenantV2(legacyTenant) },
    };

    const decoded = TenantEventEnvelope.parse(
      toEventEnvelope(legacyTenant.id, event)
    );

    expect(decoded.event_version).toBe(2);
    expect(decoded.version).toBe(STREAM_VERSION);

    const decodedTenant = match(decoded)
      .with({ event_version: 2, type: "TenantMailAdded" }, ({ data }) =>
        data.tenant ? fromTenantV2(data.tenant) : undefined
      )
      .otherwise(() => undefined);

    expect(decodedTenant?.mails).toEqual([mail]);
    expect(decodedTenant?.contactId).toBeUndefined();
  });

  it("should still decode V1 events carrying legacy mails", () => {
    const event: TenantEventV1 = {
      event_version: 1,
      type: "TenantCreated",
      data: { tenant: toTenantV1(legacyTenant) },
    };

    const decoded = TenantEventEnvelope.parse(
      toEventEnvelope(legacyTenant.id, event)
    );

    expect(decoded.event_version).toBe(1);
    expect(decoded.version).toBe(STREAM_VERSION);

    const decodedTenant = match(decoded)
      .with({ event_version: 1, type: "TenantCreated" }, ({ data }) =>
        data.tenant ? fromTenantV1(data.tenant) : undefined
      )
      .otherwise(() => undefined);

    expect(decodedTenant?.mails).toEqual([mail]);
    expect(decodedTenant?.contactId).toBeUndefined();
  });
});
