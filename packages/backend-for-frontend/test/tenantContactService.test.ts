import { AxiosError, AxiosHeaders } from "axios";
import { getMockedApiTenant } from "pagopa-interop-commons-test";
import { generateId, CorrelationId } from "pagopa-interop-models";
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
const correlationId = generateId<CorrelationId>();

function setup() {
  const token = { get: vi.fn().mockResolvedValue({ serialized: "internal" }) };
  const client = { createContact: vi.fn(), getContact: vi.fn() };
  return {
    token,
    client,
    contacts: tenantContactServiceBuilder(client, token),
  };
}

describe("tenant contacts", () => {
  it("returns only the reference on creation and uses an internal token and correlation ID", async () => {
    const { contacts, client } = setup();
    client.createContact.mockResolvedValue({
      id: tenant.contactId,
      email: address,
    });
    expect(await contacts.create(address, correlationId)).toBe(
      tenant.contactId
    );
    expect(client.createContact).toHaveBeenCalledWith(
      { email: address },
      {
        headers: {
          Authorization: "Bearer internal",
          "X-Correlation-Id": correlationId,
        },
      }
    );
  });

  it("resolves the current CDM reference even if a legacy mail is present", async () => {
    const { contacts, client } = setup();
    client.getContact.mockResolvedValue({
      id: tenant.contactId,
      email: address,
    });
    expect(await contacts.resolve(tenant, correlationId)).toEqual({ address });
    expect(client.getContact).toHaveBeenCalledWith({
      params: { contactId: tenant.contactId },
      headers: {
        Authorization: "Bearer internal",
        "X-Correlation-Id": correlationId,
      },
    });
  });

  it("reads only the latest legacy contact email without calling CDM", async () => {
    const { contacts, token, client } = setup();
    const newer = { ...legacyMail, createdAt: "2026-01-03T00:00:00Z", address };
    const digital = {
      ...legacyMail,
      kind: "DIGITAL_ADDRESS" as const,
      createdAt: "2026-01-04T00:00:00Z",
    };
    expect(
      await contacts.resolve(
        {
          ...tenant,
          contactId: undefined,
          mails: [newer, digital, legacyMail],
        },
        correlationId
      )
    ).toMatchObject({ address });
    expect(
      await contacts.resolve(
        { ...tenant, contactId: undefined, mails: [] },
        correlationId
      )
    ).toBeUndefined();
    expect(token.get).not.toHaveBeenCalled();
    expect(client.getContact).not.toHaveBeenCalled();
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
      client.getContact.mockRejectedValue(error);
      warn.mockClear();
      expect(await contacts.resolve(tenant, correlationId)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(tenant.contactId)
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(tenant.id));
      expect(JSON.stringify(warn.mock.calls)).not.toContain(address);
      expect(JSON.stringify(warn.mock.calls)).not.toContain(legacyMail.address);
    }
  );
});
