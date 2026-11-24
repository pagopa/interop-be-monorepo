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
  TenantContactAddedV3,
  generateId,
  operationForbidden,
  protobufDecoder,
  toTenantV3,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  tenantContactAlreadyAssigned,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  contactDataManagerService,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("addTenantContact", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should add the contact to a tenant without a contact", async () => {
    const tenant: Tenant = getMockTenant();
    const contactId = generateId<ContactId>();
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, contactId },
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
    const newContactId = generateId<ContactId>();
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, contactId: newContactId },
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
      type: "TenantContactAdded",
      event_version: 3,
    });

    const writtenPayload: TenantContactAddedV3 | undefined = protobufDecoder(
      TenantContactAddedV3
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...tenant,
      contactId: newContactId,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      contactId: newContactId,
      tenant: toTenantV3(expectedTenant),
    });
    expect(returnedTenant).toEqual({
      data: expectedTenant,
      metadata: { version: 1 },
    });
  });

  it("Should add the contact when the requester is an M2M admin of the tenant", async () => {
    const tenant: Tenant = getMockTenant();
    const contactId = generateId<ContactId>();
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, contactId },
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
      type: "TenantContactAdded",
      event_version: 3,
    });
    expect(returnedTenant.data.contactId).toBe(contactId);
  });

  it("Should throw tenantContactAlreadyAssigned if the contact is already the tenant contact", async () => {
    const contactId = generateId<ContactId>();
    const tenant: Tenant = { ...getMockTenant(), contactId };
    await addOneTenant(tenant);

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, contactId },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantContactAlreadyAssigned(tenant.id, contactId));
  });

  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    const tenant: Tenant = getMockTenant();

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, contactId: generateId<ContactId>() },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("Should throw operationForbidden if the requester is another tenant", async () => {
    const tenant: Tenant = getMockTenant();
    await addOneTenant(tenant);

    await expect(
      tenantService.addTenantContact(
        { tenantId: tenant.id, contactId: generateId<ContactId>() },
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("Should replace the legacy mails of the tenant with the contact, without creating another contact", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    const contactId = generateId<ContactId>();
    await addOneTenant(tenant);

    const returnedTenant = await tenantService.addTenantContact(
      { tenantId: tenant.id, contactId },
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
      type: "TenantContactAdded",
      event_version: 3,
    });

    const writtenPayload: TenantContactAddedV3 | undefined = protobufDecoder(
      TenantContactAddedV3
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...tenant,
      mails: [],
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
    expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
  });
});
