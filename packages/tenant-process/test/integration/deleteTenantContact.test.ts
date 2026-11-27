/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAuthData,
  getMockContext,
  getMockContextM2MAdmin,
  getMockTenant,
  getMockTenantMail,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  ContactId,
  Tenant,
  TenantContactDeletedV3,
  featureFlagNotEnabled,
  generateId,
  operationForbidden,
  protobufDecoder,
  toTenantV3,
} from "pagopa-interop-models";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { config } from "../../src/config/config.js";
import {
  tenantLegacyMailsNotMigrated,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("deleteTenantContact", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    (config as Record<string, unknown>).featureFlagTenantEventsV3 = true;
  });

  afterEach(() => {
    (config as Record<string, unknown>).featureFlagTenantEventsV3 = false;
  });

  it("Should delete the tenant contact", async () => {
    const contactId = generateId<ContactId>();
    const tenant: Tenant = { ...getMockTenant(), contactId };
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.deleteTenantContact(
      tenant.id,
      getMockContext({ authData: getMockAuthData(tenant.id) })
    );

    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantContactDeleted",
      event_version: 3,
    });

    const writtenPayload: TenantContactDeletedV3 | undefined = protobufDecoder(
      TenantContactDeletedV3
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...tenant,
      contactId: undefined,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      contactId,
      tenant: toTenantV3(expectedTenant),
    });
    expect(writtenPayload.tenant?.contactId).toBeUndefined();
    expect(returnedTenant).toEqual({
      data: expectedTenant,
      metadata: { version: 1 },
    });
  });

  it("Should delete the contact when the requester is an M2M admin of the tenant", async () => {
    const contactId = generateId<ContactId>();
    const tenant: Tenant = { ...getMockTenant(), contactId };
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.deleteTenantContact(
      tenant.id,
      getMockContextM2MAdmin({ organizationId: tenant.id })
    );

    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantContactDeleted",
      event_version: 3,
    });
    expect(returnedTenant.data.contactId).toBeUndefined();
  });

  it("removes the latest association and permits an immediate retry before projection", async () => {
    const tenant = getMockTenant();
    await addOneTenant(tenant);
    const ctx = getMockContext({ authData: getMockAuthData(tenant.id) });
    await tenantService.addTenantContact(
      { tenantId: tenant.id, address: "immediate@example.org" },
      ctx
    );
    const removed = await tenantService.deleteTenantContact(tenant.id, ctx);
    const repeated = await tenantService.deleteTenantContact(tenant.id, ctx);
    expect(removed.metadata.version).toBe(2);
    expect(repeated.metadata.version).toBe(2);
    expect(repeated.data.contactId).toBeUndefined();
    expect(
      (await readLastEventByStreamId(tenant.id, "tenant", postgresDB)).type
    ).toBe("TenantContactDeleted");
  });

  it("Should preserve the stream version on repeated removals of an absent contact", async () => {
    const tenant = getMockTenant();
    await addOneTenant(tenant);
    const ctx = getMockContext({ authData: getMockAuthData(tenant.id) });
    const first = await tenantService.deleteTenantContact(tenant.id, ctx);
    const second = await tenantService.deleteTenantContact(tenant.id, ctx);
    expect(first.metadata.version).toBe(0);
    expect(second).toEqual(first);
    const lastEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );
    expect(lastEvent.version).toBe("0");
  });

  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    const tenant: Tenant = getMockTenant();

    await expect(
      tenantService.deleteTenantContact(
        tenant.id,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("Should reject a tenant with legacy mails without writing an event", async () => {
    const tenant: Tenant = { ...getMockTenant(), mails: [getMockTenantMail()] };
    await addOneTenant(tenant);

    await expect(
      tenantService.deleteTenantContact(
        tenant.id,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantLegacyMailsNotMigrated(tenant.id));

    const lastEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );
    expect(lastEvent.version).toBe("0");
  });

  it("Should throw operationForbidden if the requester is another tenant", async () => {
    const contactId = generateId<ContactId>();
    const tenant: Tenant = { ...getMockTenant(), contactId };
    await addOneTenant(tenant);

    await expect(
      tenantService.deleteTenantContact(
        tenant.id,
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("Should throw featureFlagNotEnabled if tenant events V3 are disabled", async () => {
    (config as Record<string, unknown>).featureFlagTenantEventsV3 = false;

    const contactId = generateId<ContactId>();
    const tenant: Tenant = { ...getMockTenant(), contactId };
    await addOneTenant(tenant);

    await expect(
      tenantService.deleteTenantContact(
        tenant.id,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(featureFlagNotEnabled("featureFlagTenantEventsV3"));
  });
});
