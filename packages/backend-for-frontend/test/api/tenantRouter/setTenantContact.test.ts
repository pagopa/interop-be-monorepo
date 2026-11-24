/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import * as commons from "pagopa-interop-commons";
import {
  generateToken,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { TenantId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /tenants/{tenantId}/contact test", () => {
  const mailSeed = { address: "contact@example.com" };

  const createContact = vi.mocked(
    clients.contactDataManagerClient.createContact
  );

  beforeEach(() => {
    vi.mocked(vi.spyOn(commons.RefreshableInteropToken.prototype, "get"), {
      partial: true,
    }).mockResolvedValue({ serialized: "internal-token" });
    createContact
      .mockReset()
      .mockResolvedValue({ id: generateId(), email: mailSeed.address });
    clients.tenantProcessClient.tenant.addTenantContact = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = mockTokenOrganizationId,
    body: bffApi.TenantContactSeed = mailSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/contact`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("creates and associates a fresh reference on each submission of the same address", async () => {
    const ids = [generateId(), generateId()] as const;
    createContact
      .mockResolvedValueOnce({ id: ids[0], email: mailSeed.address })
      .mockResolvedValueOnce({ id: ids[1], email: mailSeed.address });
    const token = generateToken(authRole.ADMIN_ROLE);
    for (const contactId of ids) {
      expect((await makeRequest(token)).status).toBe(204);
      expect(
        clients.tenantProcessClient.tenant.addTenantContact
      ).toHaveBeenLastCalledWith(
        { contactId },
        expect.objectContaining({
          params: { tenantId: mockTokenOrganizationId },
        })
      );
    }
    expect(createContact).toHaveBeenCalledTimes(2);
    expect(clients.contactDataManagerClient.getContact).not.toHaveBeenCalled();
  });

  it("stops before association on a CDM timeout", async () => {
    createContact.mockRejectedValueOnce(new Error("timeout"));
    const response = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(response.status).toBe(500);
    expect(
      clients.tenantProcessClient.tenant.addTenantContact
    ).not.toHaveBeenCalled();
  });

  it("returns the original tenant-process rejection after contact creation", async () => {
    const problem = {
      type: "about:blank",
      status: 403,
      title: "Forbidden",
      detail: "Forbidden",
      errors: [{ code: "test", detail: "Forbidden" }],
    };
    vi.mocked(
      clients.tenantProcessClient.tenant.addTenantContact
    ).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: problem },
    });
    const response = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(response.status).toBe(403);
    expect(response.body).toEqual(problem);
    expect(createContact).toHaveBeenCalledTimes(1);
  });

  it("preserves the association if the tenant-process saves it but its response is lost", async () => {
    const contactId = generateId();
    createContact.mockResolvedValueOnce({
      id: contactId,
      email: mailSeed.address,
    });
    const associations = new Map<string, string>();
    vi.mocked(
      clients.tenantProcessClient.tenant.addTenantContact
    ).mockImplementationOnce(async (seed, { params }) => {
      associations.set(params.tenantId, seed.contactId);
      throw new Error("timeout");
    });
    const response = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(response.status).toBe(500);
    expect(associations.get(mockTokenOrganizationId)).toBe(contactId);
    expect(
      clients.tenantProcessClient.tenant.addTenantContact
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects a viewer before creating a contact", async () => {
    const response = await makeRequest(generateToken(authRole.VIEWER_ROLE));
    expect(response.status).toBe(403);
    expect(createContact).not.toHaveBeenCalled();
  });

  it("forwards a CDM Problem without associating a contact", async () => {
    const problem = {
      type: "about:blank",
      status: 400,
      title: "Bad request",
      detail: "Invalid contact",
      errors: [{ code: "test", detail: "Invalid contact" }],
    };
    createContact.mockRejectedValueOnce({
      isAxiosError: true,
      message: mailSeed.address,
      response: { status: 400, data: problem },
    });
    const response = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(response.status).toBe(400);
    expect(response.body).toEqual(problem);
    expect(
      clients.tenantProcessClient.tenant.addTenantContact
    ).not.toHaveBeenCalled();
  });

  it("rejects writes for another tenant before creating a contact", async () => {
    const response = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      generateId<TenantId>()
    );
    expect(response.status).toBe(403);
    expect(createContact).not.toHaveBeenCalled();
  });

  it("keeps the email out of request logs on success, failure and malformed input", async () => {
    const record = vi.fn();
    const spy = vi.spyOn(commons, "logger").mockReturnValue({
      ...commons.genericLogger,
      error: record,
      warn: record,
      info: record,
      debug: record,
    });
    try {
      const token = generateToken(authRole.ADMIN_ROLE);
      expect((await makeRequest(token)).status).toBe(204);
      createContact.mockRejectedValueOnce(new Error(mailSeed.address));
      expect((await makeRequest(token)).status).toBe(500);
      const invalid = await request(api)
        .post(`${appBasePath}/tenants/${mockTokenOrganizationId}/contact`)
        .set("Authorization", `Bearer ${token}`)
        .send({ [mailSeed.address]: true });
      expect(invalid.status).toBe(400);
      const malformed = await request(api)
        .post(`${appBasePath}/tenants/${mockTokenOrganizationId}/contact`)
        .set("Authorization", `Bearer ${token}`)
        .type("json")
        .send(mailSeed.address);
      expect(malformed.status).toBe(400);
      expect(record).toHaveBeenCalled();
      expect(JSON.stringify(record.mock.calls)).not.toContain(mailSeed.address);
    } finally {
      spy.mockRestore();
    }
  });

  it.each([
    { tenantId: "invalid" },
    { body: {} },
    { body: { address: "invalid" } },
    { body: { ...mailSeed, address: undefined } },
    { body: { ...mailSeed, kind: "invalid" } },
    { body: { ...mailSeed, extraField: true } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId as TenantId,
        body as bffApi.TenantContactSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
