import {
  getMockAuthData,
  getMockContext,
  getMockContextM2MAdmin,
  getMockTenant,
  getMockTenantMail,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { contact } from "pagopa-interop-contact-data-db-models";
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  ContactId,
  Tenant,
  TenantContactAddedV3,
  eventConflictError,
  featureFlagNotEnabled,
  generateId,
  operationForbidden,
  protobufDecoder,
  toTenantV3,
} from "pagopa-interop-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
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
  contactDB,
  readModelDB,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

const address = "tenant@example.org";

describe("addTenantContact", async () => {
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

  it("Should add the contact to a tenant without a contact", async () => {
    const tenant: Tenant = getMockTenant();
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, address },
      getMockContext({ authData: getMockAuthData(tenant.id) })
    );

    const contactId = returnedTenant.data.contactId;
    expect(contactId).toBeDefined();
    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantContactAdded",
      event_version: 3,
    });

    const writtenPayload: TenantContactAddedV3 | undefined = protobufDecoder(
      TenantContactAddedV3
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...tenant,
      contactId,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      contactId,
      tenant: toTenantV3(expectedTenant),
    });
    expect(returnedTenant).toEqual({
      data: expectedTenant,
      metadata: { version: 1 },
    });
  });

  it("Should replace the current contact with a single TenantContactAdded event", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      contactId: generateId<ContactId>(),
    };
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, address },
      getMockContext({ authData: getMockAuthData(tenant.id) })
    );

    const contactId = returnedTenant.data.contactId;
    expect(contactId).toBeDefined();
    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantContactAdded",
      event_version: 3,
    });

    const writtenPayload: TenantContactAddedV3 | undefined = protobufDecoder(
      TenantContactAddedV3
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...tenant,
      contactId,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      contactId,
      tenant: toTenantV3(expectedTenant),
    });
    expect(returnedTenant).toEqual({
      data: expectedTenant,
      metadata: { version: 1 },
    });
  });

  it("Should add the contact when the requester is an M2M admin of the tenant", async () => {
    const tenant: Tenant = getMockTenant();
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, address },
      getMockContextM2MAdmin({ organizationId: tenant.id })
    );

    const contactId = returnedTenant.data.contactId;
    expect(contactId).toBeDefined();
    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantContactAdded",
      event_version: 3,
    });
    expect(
      await contactDB.select({ email: contact.email }).from(contact)
    ).toEqual([{ email: address }]);
  });

  it("creates distinct contacts for repeated submissions of the same address", async () => {
    const tenant = getMockTenant();
    const ctx = getMockContext({ authData: getMockAuthData(tenant.id) });
    const seed = { tenantId: tenant.id, address };
    await addOneTenant(tenant);
    const first = await tenantService.addTenantContact(seed, ctx);
    await upsertTenant(readModelDB, first.data, first.metadata.version);
    const second = await tenantService.addTenantContact(seed, ctx);
    expect(first.data.contactId).not.toEqual(second.data.contactId);
    expect(await contactDB.select().from(contact)).toHaveLength(2);
  });

  it("keeps the referenced contact when a concurrent write loses the event version race", async () => {
    const tenant = getMockTenant();
    const ctx = getMockContext({ authData: getMockAuthData(tenant.id) });
    await addOneTenant(tenant);
    const first = await tenantService.addTenantContact(
      { tenantId: tenant.id, address },
      ctx
    );
    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, address: "second@example.org" },
        ctx
      )
    ).rejects.toThrowError(eventConflictError(ctx.correlationId, tenant.id, 0));
    expect(
      await contactDB
        .select({ id: contact.id, email: contact.email })
        .from(contact)
    ).toEqual(
      expect.arrayContaining([{ id: first.data.contactId, email: address }])
    );
    expect(
      (await readLastEventByStreamId(tenant.id, "tenant", postgresDB)).version
    ).toBe("1");
  });

  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    const tenant: Tenant = getMockTenant();

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, address },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("Should throw operationForbidden if the requester is another tenant", async () => {
    const tenant: Tenant = getMockTenant();
    await addOneTenant(tenant);

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, address },
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(operationForbidden);
    expect(await contactDB.select().from(contact)).toHaveLength(0);
  });

  it("Should throw featureFlagNotEnabled if tenant events V3 are disabled", async () => {
    (config as Record<string, unknown>).featureFlagTenantEventsV3 = false;

    const tenant: Tenant = getMockTenant();
    await addOneTenant(tenant);

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, address },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(featureFlagNotEnabled("featureFlagTenantEventsV3"));
  });

  it("Should fail without writing events if the tenant still has legacy mails", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(tenant);

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, address },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantLegacyMailsNotMigrated(tenant.id));
    expect(await contactDB.select().from(contact)).toHaveLength(0);

    const lastEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );
    expect(lastEvent).toMatchObject({ version: "0", type: "TenantOnboarded" });
  });
});
