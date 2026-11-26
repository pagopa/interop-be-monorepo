import { AxiosError, AxiosHeaders } from "axios";
import { getMockedApiTenant } from "pagopa-interop-commons-test";
import { generateId, CorrelationId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { tenantContactServiceBuilder } from "../src/services/tenantContactService.js";

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("pagopa-interop-commons", async (original) => ({
  ...(await original<typeof import("pagopa-interop-commons")>()),
  logger: () => ({ warn }),
}));

const address = "current@example.org";
const legacyMail = {
  id: "legacy",
  kind: "CONTACT_EMAIL" as const,
  address: "legacy@example.org",
  createdAt: "2026-01-01T00:00:00Z",
};
const tenant = {
  ...getMockedApiTenant(),
  contactId: generateId(),
  mails: [legacyMail],
};
const organizationId = generateId<TenantId>();
const headers = {
  "X-Correlation-Id": generateId<CorrelationId>(),
  Authorization: "Bearer user",
  "X-Forwarded-For": undefined,
};
function setup() {
  const client = { getTenantContact: vi.fn() };
  return { client, contacts: tenantContactServiceBuilder(client) };
}

describe("tenant contacts", () => {
  it("omits another tenant's contact including legacy mail", async () => {
    const { contacts, client } = setup();
    expect(
      await contacts.resolve(tenant, organizationId, headers)
    ).toBeUndefined();
    expect(client.getTenantContact).not.toHaveBeenCalled();
  });

  it("propagates authorization failures for the caller's organization", async () => {
    const { contacts, client } = setup();
    const error = { isAxiosError: true, response: { status: 403 } };
    client.getTenantContact.mockRejectedValue(error);
    await expect(
      contacts.resolve({ id: organizationId }, organizationId, headers)
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it.each([404, 500, 503, undefined])(
    "omits the contact on %s and logs identifiers only",
    async (status) => {
      const { contacts, client } = setup();
      const error = new AxiosError(
        address,
        status ? undefined : "ECONNABORTED",
        undefined,
        undefined,
        status
          ? {
              status,
              statusText: "",
              headers: {},
              config: { headers: new AxiosHeaders() },
              data: address,
            }
          : undefined
      );
      client.getTenantContact.mockRejectedValue(error);
      warn.mockClear();
      expect(
        await contacts.resolve({ id: organizationId }, organizationId, headers)
      ).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(organizationId)
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(address);
      expect(JSON.stringify(warn.mock.calls)).not.toContain(legacyMail.address);
    }
  );
});
