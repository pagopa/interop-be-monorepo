import {
  getMockAuthData,
  getMockContext,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import { contact } from "pagopa-interop-contact-data-db-models";
import {
  generateId,
  ContactId,
  operationForbidden,
  tenantMailKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { tenantContactNotFound } from "../../src/model/domain/errors.js";
import { addOneTenant, contactDB, tenantService } from "../integrationUtils.js";

describe("getTenantContact", () => {
  const tenant = getMockTenant();
  const ctx = getMockContext({ authData: getMockAuthData(tenant.id) });
  const address = "contact@example.org";
  const id = generateId<ContactId>();

  it("reads the current reference for an organization member", async () => {
    await contactDB
      .insert(contact)
      .values({ id, email: address, createdAt: new Date().toISOString() });
    await addOneTenant({ ...tenant, contactId: id });
    await expect(
      tenantService.getTenantContact(tenant.id, ctx)
    ).resolves.toEqual({ address });
  });

  it("checks ownership before reading a tenant or its legacy mail", async () => {
    await expect(
      tenantService.getTenantContact(generateId(), ctx)
    ).rejects.toThrow(operationForbidden);
  });

  it("uses the latest legacy contact email including its description", async () => {
    const latest = {
      ...getMockTenantMail(),
      address,
      createdAt: new Date("2026-01-02"),
    };
    await addOneTenant({
      ...tenant,
      mails: [
        latest,
        { ...getMockTenantMail(), createdAt: new Date("2026-01-01") },
        getMockTenantMail(tenantMailKind.DigitalAddress),
      ],
    });
    await expect(
      tenantService.getTenantContact(tenant.id, ctx)
    ).resolves.toEqual({ address, description: latest.description });
  });

  it("returns not found when the referenced row is absent even if a legacy address exists", async () => {
    await addOneTenant({
      ...tenant,
      contactId: id,
      mails: [getMockTenantMail()],
    });
    await expect(
      tenantService.getTenantContact(tenant.id, ctx)
    ).rejects.toThrow(tenantContactNotFound(tenant.id));
  });
});
