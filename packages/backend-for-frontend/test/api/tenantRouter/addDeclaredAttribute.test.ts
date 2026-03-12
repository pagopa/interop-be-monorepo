/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { bffApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /tenants/attributes/declared test", () => {
  const attributeSeed: bffApi.DeclaredTenantAttributeSeed = {
    id: generateId(),
    delegationId: generateMock(z.string().uuid().optional()),
  };

  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.addDeclaredAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.DeclaredTenantAttributeSeed = attributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/attributes/declared`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { body: {} },
    { body: { id: "invalid" } },
    { body: { delegationId: generateId() } },
    { body: { ...attributeSeed, delegationId: "invalid" } },
    { body: { ...attributeSeed, extraField: true } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as bffApi.DeclaredTenantAttributeSeed
    );
    expect(res.status).toBe(400);
  });
});
