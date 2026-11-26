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

  beforeEach(() => {
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

  it("passes the address and caller token to tenant-process", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    expect((await makeRequest(token)).status).toBe(204);
    expect(
      clients.tenantProcessClient.tenant.addTenantContact
    ).toHaveBeenCalledWith(
      mailSeed,
      expect.objectContaining({
        params: { tenantId: mockTokenOrganizationId },
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      })
    );
  });

  it("returns the original tenant-process rejection on submission", async () => {
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
  });

  it("preserves the association if the tenant-process saves it but its response is lost", async () => {
    const associations = new Map<string, string>();
    vi.mocked(
      clients.tenantProcessClient.tenant.addTenantContact
    ).mockImplementationOnce(async (seed, { params }) => {
      associations.set(params.tenantId, seed.address);
      throw new Error("timeout");
    });
    const response = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(response.status).toBe(500);
    expect(associations.get(mockTokenOrganizationId)).toBe(mailSeed.address);
    expect(
      clients.tenantProcessClient.tenant.addTenantContact
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects a viewer before creating a contact", async () => {
    const response = await makeRequest(generateToken(authRole.VIEWER_ROLE));
    expect(response.status).toBe(403);
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
    expect(
      clients.tenantProcessClient.tenant.addTenantContact
    ).not.toHaveBeenCalled();
  });

  it("keeps the email out of request logs on success and tenant-process failure", async () => {
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
      vi.mocked(
        clients.tenantProcessClient.tenant.addTenantContact
      ).mockRejectedValueOnce(new Error(mailSeed.address));
      expect((await makeRequest(token)).status).toBe(500);
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
